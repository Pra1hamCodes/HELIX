"""Page 4 — Attack Pattern Analysis."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card, get_attack_color,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import apply_dark_theme, plotly_dark_layout, radar_chart, violin_plot

FLAG_COLS = ["FIN Flag Count", "SYN Flag Count", "RST Flag Count",
             "PSH Flag Count", "ACK Flag Count", "URG Flag Count"]
PORT_COL = "Destination Port"
DUR_COL = "Flow Duration"
BYTES_COL = "Flow Bytes/s"
PKT_COL = "Flow Packets/s"


def _safe_mean(df: pd.DataFrame, col: str) -> float:
    if col in df.columns:
        return float(df[col].mean())
    return 0.0


def render(df: pd.DataFrame):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("⚔️ Attack Pattern Analysis",
        "Behavioral fingerprinting — what does each attack look like?"), unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not c.startswith("_")]
    attack_classes = sorted(df[LABEL_COL].unique().tolist())
    n_attacks = len([a for a in attack_classes if a != "BENIGN"])
    benign_means = df[df[LABEL_COL] == "BENIGN"][num_cols].mean()

    st.markdown(summary_card([
        f"{n_attacks} distinct attack types detected in the dataset.",
        f"Average flow duration differs {round(df[df[LABEL_COL]!='BENIGN'][DUR_COL].mean() / max(df[df[LABEL_COL]=='BENIGN'][DUR_COL].mean(),1),1)}× between attack and benign flows." if DUR_COL in df.columns else "Flow Duration column not found.",
        "Radar chart and flag analysis reveal unique behavioral signatures per attack.",
    ]), unsafe_allow_html=True)

    # ── Attack profile cards ──────────────────────────────────────────────────
    st.markdown(section_header("Attack Profile Cards",
        "Summary fingerprint for each attack class"), unsafe_allow_html=True)

    for cls in attack_classes:
        sub = df[df[LABEL_COL] == cls]
        pct = round(len(sub) / len(df) * 100, 2)
        top5 = sub[num_cols].mean().nlargest(5)
        color = get_attack_color(cls)

        with st.expander(f"{cls}  —  {len(sub):,} flows  ({pct}%)", expanded=(cls == "BENIGN")):
            crd1, crd2, crd3 = st.columns(3)
            with crd1:
                st.markdown(f"**Avg Flow Duration:** {_safe_mean(sub, DUR_COL):,.0f} µs")
            with crd2:
                st.markdown(f"**Avg Bytes/s:** {_safe_mean(sub, BYTES_COL):,.0f}")
            with crd3:
                st.markdown(f"**Avg Packets/s:** {_safe_mean(sub, PKT_COL):,.0f}")

            st.markdown(f"**Top 5 features by mean value:**")
            for feat, val in top5.items():
                benign_val = benign_means.get(feat, 0)
                diff = "↑" if val > benign_val else "↓"
                st.markdown(
                    f'<span style="color:{color};font-weight:600;">{feat}</span>: '
                    f'{val:.3f} {diff} (BENIGN: {benign_val:.3f})',
                    unsafe_allow_html=True,
                )

    # ── Radar chart comparison ────────────────────────────────────────────────
    st.markdown(section_header("Attack Fingerprint Radar Chart",
        "Compare behavioral signatures of two attack types"), unsafe_allow_html=True)

    radar_features = [c for c in [
        "SYN Flag Count", "ACK Flag Count", "Flow Duration",
        "Total Fwd Packets", "Total Backward Packets",
        "Flow Bytes/s", "Flow Packets/s", "PSH Flag Count",
    ] if c in df.columns]

    if len(radar_features) >= 4:
        rcol1, rcol2 = st.columns(2)
        with rcol1:
            cls_a = st.selectbox("Attack Class A", attack_classes, index=0, key="rad_a")
        with rcol2:
            cls_b = st.selectbox("Attack Class B", attack_classes,
                index=min(1, len(attack_classes) - 1), key="rad_b")

        all_means = df.groupby(LABEL_COL)[radar_features].mean()
        maxvals = all_means.max()
        maxvals = maxvals.replace(0, 1)

        traces = {}
        for cls in [cls_a, cls_b]:
            if cls in all_means.index:
                normed = (all_means.loc[cls] / maxvals).tolist()
                traces[cls] = normed
        if traces:
            fig_rad = radar_chart(radar_features, traces)
            st.plotly_chart(fig_rad, use_container_width=True)
    else:
        st.markdown(insight_box("Not enough flag/flow columns found for radar chart.", "warn"),
            unsafe_allow_html=True)

    st.markdown(insight_box(
        "Radar chart shows normalized feature values per attack class. "
        "Shapes that look dramatically different = behaviorally distinct attacks = easier to classify. "
        "Overlapping shapes = classifier will struggle to separate them.",
        "info",
    ), unsafe_allow_html=True)

    # ── Flag analysis ─────────────────────────────────────────────────────────
    st.markdown(section_header("TCP Flag Distribution by Attack Type",
        "SYN floods, RST storms, ACK patterns"), unsafe_allow_html=True)

    avail_flags = [c for c in FLAG_COLS if c in df.columns]
    if avail_flags:
        flag_means = df.groupby(LABEL_COL)[avail_flags].mean().reset_index()
        fig_flags = go.Figure()
        for flag in avail_flags:
            fig_flags.add_trace(go.Bar(
                name=flag.replace(" Flag Count", ""),
                x=flag_means[LABEL_COL],
                y=flag_means[flag],
                marker_color=get_attack_color(flag.split()[0]) if flag.split()[0] in COLORS else COLORS["accent"],
            ))
        plotly_dark_layout(fig_flags, "Mean TCP Flag Counts per Attack Class", h=420)
        fig_flags.update_layout(barmode="group",
            xaxis=dict(tickangle=-30, tickfont=dict(size=10)))
        st.plotly_chart(fig_flags, use_container_width=True)
        st.markdown(insight_box(
            "SYN Flag Count spikes in DoS/DDoS attacks — these are SYN flood patterns. "
            "RST Flag Count spikes indicate connection teardown-heavy traffic (PortScan). "
            "BENIGN traffic shows balanced ACK/PSH patterns.",
            "info",
        ), unsafe_allow_html=True)
    else:
        st.markdown(insight_box("No TCP flag columns found in dataset.", "warn"), unsafe_allow_html=True)

    # ── Port analysis ─────────────────────────────────────────────────────────
    st.markdown(section_header("Top Destination Ports by Attack Type",
        "PortScan targets many ports; DoS concentrates on one"), unsafe_allow_html=True)

    if PORT_COL in df.columns:
        sel_cls_port = st.selectbox("Select Attack Class", attack_classes, key="port_cls")
        sub_port = df[df[LABEL_COL] == sel_cls_port]
        top_ports = sub_port[PORT_COL].value_counts().head(20)
        fig_ports = go.Figure(go.Bar(
            x=top_ports.index.astype(str),
            y=top_ports.values,
            marker_color=get_attack_color(sel_cls_port),
            text=top_ports.values,
            textposition="outside",
        ))
        plotly_dark_layout(fig_ports, f"Top 20 Destination Ports — {sel_cls_port}", h=380)
        st.plotly_chart(fig_ports, use_container_width=True)

        # Full stacked bar
        all_top_ports = df[PORT_COL].value_counts().head(20).index.tolist()
        port_class_df = df[df[PORT_COL].isin(all_top_ports)].groupby(
            [PORT_COL, LABEL_COL]).size().reset_index(name="count")
        fig_sp = px.bar(
            port_class_df, x=PORT_COL.replace("Destination Port", "Port"), y="count",
            color=LABEL_COL,
            color_discrete_map={l: get_attack_color(l) for l in port_class_df[LABEL_COL].unique()},
            template="plotly_dark", barmode="stack",
            title="Top 20 Ports — Attack Mix",
            labels={PORT_COL: "Port", "count": "Flows"},
        )
        plotly_dark_layout(fig_sp, "Port vs Attack Type Distribution", h=380)
        st.plotly_chart(fig_sp, use_container_width=True)
        st.markdown(insight_box(
            "PortScan attacks spread uniformly across many ports — a wide bar chart signature. "
            "DoS/DDoS attacks concentrate flows on specific service ports (80, 443, 22). "
            "This port concentration is a reliable IDS rule candidate.",
            "info",
        ), unsafe_allow_html=True)
    else:
        st.markdown(insight_box("Destination Port column not found.", "warn"), unsafe_allow_html=True)

    # ── Flow duration violin ──────────────────────────────────────────────────
    st.markdown(section_header("Flow Duration Distribution",
        "Violin plot — DDoS = short, Infiltration = long"), unsafe_allow_html=True)

    if DUR_COL in df.columns:
        fig_viol = violin_plot(df, DUR_COL, LABEL_COL)
        st.plotly_chart(fig_viol, use_container_width=True)
        st.markdown(insight_box(
            f"DDoS attacks show extremely short flow durations (flood pattern). "
            f"Infiltration and Botnet attacks show longer, sustained connections. "
            f"Flow duration alone is a strong discriminator for several attack types.",
            "info",
        ), unsafe_allow_html=True)
    else:
        st.markdown(insight_box(f"Column '{DUR_COL}' not found.", "warn"), unsafe_allow_html=True)

    # ── Bytes/packets heatmap ─────────────────────────────────────────────────
    st.markdown(section_header("Behavioral Heatmap: Attack × Feature",
        "Normalized mean values — shows fingerprints at a glance"), unsafe_allow_html=True)

    hmap_feats = [c for c in [
        BYTES_COL, PKT_COL, DUR_COL,
        "Total Fwd Packets", "Total Backward Packets",
        "SYN Flag Count", "ACK Flag Count", "Fwd Packet Length Mean",
    ] if c in df.columns]

    if len(hmap_feats) >= 3:
        hmap_df = df.groupby(LABEL_COL)[hmap_feats].mean()
        maxv = hmap_df.max().replace(0, 1)
        hmap_norm = hmap_df.div(maxv)
        fig_hmap = go.Figure(go.Heatmap(
            z=hmap_norm.values.tolist(),
            x=hmap_feats,
            y=hmap_norm.index.tolist(),
            colorscale="YlOrRd",
            colorbar=dict(tickfont=dict(color="#cce8ff")),
            hoverongaps=False,
        ))
        plotly_dark_layout(fig_hmap, "Normalized Feature Means per Attack Class", h=350)
        fig_hmap.update_layout(xaxis=dict(tickangle=-30, tickfont=dict(size=9)))
        st.plotly_chart(fig_hmap, use_container_width=True)
        st.markdown(insight_box(
            "Each row is an attack's behavioral fingerprint. "
            "Bright (high) values indicate the attack heavily uses that feature. "
            "DDoS will typically show high bytes/s and short durations; "
            "PortScan will show high packet counts.",
            "info",
        ), unsafe_allow_html=True)

    # ── Anomaly z-score table ─────────────────────────────────────────────────
    st.markdown(section_header("Anomaly Scoring: Z-Score vs BENIGN Baseline"), unsafe_allow_html=True)

    key_feats = num_cols[:15] if len(num_cols) >= 15 else num_cols
    benign_sub = df[df[LABEL_COL] == "BENIGN"]
    b_means = benign_sub[key_feats].mean()
    b_stds = benign_sub[key_feats].std().replace(0, 1)

    z_rows = {}
    for cls in attack_classes:
        sub = df[df[LABEL_COL] == cls]
        if len(sub) < 5:
            continue
        z_rows[cls] = ((sub[key_feats].mean() - b_means) / b_stds).round(2)
    z_df = pd.DataFrame(z_rows).T

    if not z_df.empty:
        fig_z = go.Figure(go.Heatmap(
            z=z_df.values.tolist(),
            x=z_df.columns.tolist(),
            y=z_df.index.tolist(),
            colorscale="RdBu",
            zmid=0,
            colorbar=dict(tickfont=dict(color="#cce8ff")),
        ))
        plotly_dark_layout(fig_z, "Z-Score vs BENIGN: Attack × Feature", h=350)
        fig_z.update_layout(xaxis=dict(tickangle=-30, tickfont=dict(size=9)))
        st.plotly_chart(fig_z, use_container_width=True)

        max_z_col = z_df.abs().max().idxmax()
        max_z_row = z_df[max_z_col].abs().idxmax()
        st.markdown(insight_box(
            f"Highest anomaly: {max_z_row} deviates {z_df.loc[max_z_row, max_z_col]:.1f}σ "
            f"from BENIGN on feature '{max_z_col}'. "
            "Features with consistent large z-scores across attacks are universal detectors.",
            "warn",
        ), unsafe_allow_html=True)

    # ── Co-occurrence timeline ────────────────────────────────────────────────
    st.markdown(section_header("Attack Co-occurrence Timeline"), unsafe_allow_html=True)

    if "Timestamp" in df.columns and SOURCE_COL in df.columns:
        try:
            ts_df = df.copy()
            ts_df["_ts"] = pd.to_datetime(ts_df["Timestamp"], errors="coerce")
            ts_df = ts_df.dropna(subset=["_ts"])
            ts_df["_hour"] = ts_df["_ts"].dt.floor("1H")
            cooc = ts_df.groupby(["_hour", LABEL_COL]).size().reset_index(name="count")
            fig_co = px.bar(
                cooc, x="_hour", y="count", color=LABEL_COL,
                color_discrete_map={l: get_attack_color(l) for l in cooc[LABEL_COL].unique()},
                template="plotly_dark", barmode="stack",
                labels={"_hour": "Hour", "count": "Flows"},
            )
            plotly_dark_layout(fig_co, "Hourly Attack Co-occurrence Timeline", h=380)
            st.plotly_chart(fig_co, use_container_width=True)
        except Exception as e:
            st.markdown(insight_box(f"Timeline failed: {e}", "warn"), unsafe_allow_html=True)
    else:
        st.markdown(insight_box(
            "Timestamp column not found — co-occurrence timeline unavailable.",
            "warn",
        ), unsafe_allow_html=True)
