"""Page 1 — Data Health Report (Cyber redesign)."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import streamlit as st

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    metric_card, insight_box, summary_card,
)
from utils.data_loader import (
    LABEL_COL, SOURCE_COL, quality_report, compute_health_score,
)
from utils.charts import apply_dark_theme


def render(df, raw_df, file_names, orig_rows, clean_rows, clip_info):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header(
        "📊 Data Health Report",
        "First-pass quality check — what is the data quality before any analysis?"
    ), unsafe_allow_html=True)

    q_df = quality_report(raw_df)
    dropped = orig_rows - clean_rows
    pct_retained = round(clean_rows / max(orig_rows, 1) * 100, 1)

    if LABEL_COL in raw_df.columns:
        label_issues = int(
            (raw_df[LABEL_COL].astype(str) != raw_df[LABEL_COL].astype(str).str.strip()).sum()
        )
    else:
        label_issues = 0

    health = compute_health_score(q_df, clip_info, label_issues)
    total_null_pct = round(q_df["Null %"].mean(), 2)
    high_null_cols = int((q_df["Null %"] > 5).sum())
    total_clipped = sum(v["clipped"] for v in clip_info.values()) if clip_info else 0

    st.markdown(summary_card([
        f"{pct_retained}% of data retained after cleaning — {dropped:,} rows removed from {orig_rows:,} total.",
        f"Mean null rate: {total_null_pct}%. {high_null_cols} columns exceed 5% null threshold.",
        f"{total_clipped:,} outlier values clipped to [p1 → p99] across all numeric features.",
    ]), unsafe_allow_html=True)

    # ── Summary metrics row ───────────────────────────────────────────────────
    st.markdown(section_header("Overview Metrics"), unsafe_allow_html=True)
    c1, c2, c3, c4, c5 = st.columns(5)
    for col, (lbl, val, color, ico) in zip(
        [c1, c2, c3, c4, c5],
        [
            ("Total Rows Loaded",  f"{orig_rows:,}",    COLORS["accent"],  "📦"),
            ("Features",           f"{df.shape[1]}",    COLORS["accent"],  "⚙"),
            ("Files Loaded",       f"{len(file_names)}",COLORS["accent2"], "📁"),
            ("Rows Dropped",       f"{dropped:,}",
             COLORS["danger"] if dropped > 5000 else COLORS["warning"], "✂"),
            ("Data Retained",      f"{pct_retained}%",
             COLORS["accent2"] if pct_retained > 95 else COLORS["warning"], "✅"),
        ],
    ):
        col.markdown(metric_card(lbl, val, color=color, icon=ico), unsafe_allow_html=True)

    # ── Health score ──────────────────────────────────────────────────────────
    st.markdown(section_header("Data Health Score"), unsafe_allow_html=True)
    hcol1, hcol2 = st.columns([1, 3])
    with hcol1:
        h_color = (COLORS["accent2"] if health >= 80
                   else COLORS["warning"] if health >= 60
                   else COLORS["danger"])
        grade = "EXCELLENT" if health >= 85 else "GOOD" if health >= 70 else "FAIR" if health >= 55 else "POOR"
        st.markdown(f"""
<div style="
    background: rgba(11,18,32,0.9);
    border: 1px solid {h_color}33;
    border-radius: 14px;
    padding: 30px;
    text-align: center;
    box-shadow: 0 0 30px {h_color}15;
    animation: fadeSlideUp 0.5s ease;
">
  <div style="font-family:'JetBrains Mono',monospace; font-size:3.8rem;
    font-weight:700; color:{h_color}; text-shadow: 0 0 30px {h_color}66;
    line-height:1;">{health}</div>
  <div style="color:#3a5070; font-size:0.72rem; font-family:'Oxanium',sans-serif;
    letter-spacing:0.15em; margin-top:4px;">/ 100</div>
  <div style="color:{h_color}; font-size:0.8rem; font-family:'Oxanium',sans-serif;
    font-weight:700; letter-spacing:0.12em; margin-top:10px;
    text-shadow:0 0 12px {h_color}88;">{grade}</div>
</div>""", unsafe_allow_html=True)

    with hcol2:
        st.markdown(insight_box(
            f"Score computed from: null rate ({total_null_pct}%), "
            f"{high_null_cols} high-null columns, "
            f"{q_df['Inf Count'].sum()} infinity values, "
            f"{label_issues} label whitespace anomalies, "
            f"and {total_clipped:,} clipped outliers. "
            "≥ 80 = production-ready. < 60 = requires remediation before modeling.",
            "success" if health >= 75 else "warn",
        ), unsafe_allow_html=True)
        st.progress(health / 100)
        st.markdown(f"""
<div style="display:flex; gap:16px; margin-top:8px; flex-wrap:wrap;">
{''.join(f'<div style="background:rgba(11,18,32,0.6);border:1px solid rgba(0,245,255,0.1);border-radius:6px;padding:8px 14px;font-family:JetBrains Mono,monospace;font-size:0.75rem;color:#3a5070;"><span style="color:#00f5ff;">{k}</span>: {v}</div>'
for k, v in [("NULL_RATE",f"{total_null_pct}%"),("DROPPED",f"{dropped:,}"),("CLIPPED",f"{total_clipped:,}"),("LABELS",f"{label_issues} issues")])}
</div>""", unsafe_allow_html=True)

    # ── Quality scorecard ─────────────────────────────────────────────────────
    st.markdown(section_header("Per-Column Quality Scorecard",
        "Red = > 5% null | Yellow = any null | Green = clean"), unsafe_allow_html=True)

    def color_null(val):
        try:
            v = float(val)
            if v > 5:   return f"background-color: rgba(255,34,68,0.12); color: {COLORS['danger']}"
            elif v > 0: return f"background-color: rgba(255,214,10,0.1); color: {COLORS['warning']}"
            return f"color: {COLORS['accent2']}"
        except Exception: return ""

    styled = q_df.style.applymap(color_null, subset=["Null %"])
    st.dataframe(styled, use_container_width=True, height=340)
    st.markdown(insight_box(
        f"Of {len(q_df)} columns: "
        f"{(q_df['Null %'] == 0).sum()} fully clean, "
        f"{int(((q_df['Null %'] > 0) & (q_df['Null %'] <= 5)).sum())} minor nulls (<5%), "
        f"{high_null_cols} significant nulls (>5%). "
        "High-null columns must be investigated before model training.",
        "info" if high_null_cols == 0 else "warn",
    ), unsafe_allow_html=True)

    # ── Missing value heatmap ─────────────────────────────────────────────────
    st.markdown(section_header("Null Heatmap: Feature × Day File",
        "Color intensity = null %  — spot systematic data gaps"), unsafe_allow_html=True)

    if SOURCE_COL in raw_df.columns:
        files = raw_df[SOURCE_COL].unique().tolist()
        non_src = [c for c in raw_df.columns if not c.startswith("_")]
        pivot = {f: {c: raw_df[raw_df[SOURCE_COL] == f][c].isna().mean() * 100
                     for c in non_src} for f in files}
        heat_df = pd.DataFrame(pivot).T
        num_h = heat_df.select_dtypes(include=[np.number])
        if not num_h.empty and num_h.max().max() > 0:
            top_cols = num_h.max().nlargest(30).index.tolist()
            apply_dark_theme()
            fig, ax = plt.subplots(figsize=(14, max(3, len(files) * 0.9 + 1)))
            fig.patch.set_facecolor("#020409")
            ax.set_facecolor("#080d1a")
            cmap = sns.color_palette("YlOrRd", as_cmap=True)
            sns.heatmap(heat_df[top_cols], ax=ax, cmap="YlOrRd",
                        annot=True, fmt=".1f", linewidths=0.4,
                        linecolor="#0d1526",
                        cbar_kws={"label": "Null %"})
            ax.set_title("Null % per Feature per Day", color="#00f5ff", pad=12, fontsize=13)
            ax.tick_params(colors="#3a5070")
            plt.xticks(rotation=45, ha="right", fontsize=8, color="#3a5070")
            plt.yticks(color="#3a5070")
            plt.tight_layout()
            st.pyplot(fig, use_container_width=True)
            plt.close(fig)
        else:
            st.markdown(insight_box("No missing values detected — all files are complete.", "success"),
                unsafe_allow_html=True)
    else:
        st.markdown(insight_box("Upload multiple files to see per-file null heatmap.", "warn"),
            unsafe_allow_html=True)

    # ── Duplicate analysis ────────────────────────────────────────────────────
    st.markdown(section_header("Duplicate Row Analysis"), unsafe_allow_html=True)
    feat_cols = [c for c in raw_df.columns if not c.startswith("_")]
    n_dups = int(raw_df.duplicated(subset=feat_cols, keep=False).sum())
    dup_rate = round(n_dups / max(len(raw_df), 1) * 100, 2)

    dc1, dc2 = st.columns(2)
    dc1.markdown(metric_card("Exact Duplicates", f"{n_dups:,}",
        color=COLORS["danger"] if n_dups > 1000 else COLORS["accent2"], icon="♊"), unsafe_allow_html=True)
    dc2.markdown(metric_card("Duplicate Rate", f"{dup_rate}%",
        color=COLORS["warning"] if dup_rate > 1 else COLORS["accent2"], icon="📊"), unsafe_allow_html=True)
    if n_dups > 0:
        with st.expander("View sample duplicate rows"):
            st.dataframe(raw_df[raw_df.duplicated(subset=feat_cols, keep=False)].head(10),
                use_container_width=True)
    st.markdown(insight_box(
        f"{n_dups:,} duplicates ({dup_rate}%). "
        "Duplicates bias model training — they create artificial weight on repeated patterns. "
        "All duplicates were removed during the cleaning pipeline.",
        "danger" if n_dups > 5000 else "warn" if n_dups > 0 else "success",
    ), unsafe_allow_html=True)

    # ── Outlier clipping report ────────────────────────────────────────────────
    st.markdown(section_header("Outlier Clipping Report",
        "Values clipped to [p1, p99] per feature"), unsafe_allow_html=True)
    if clip_info:
        clip_rows = [{
            "Feature": col, "P1": round(v["p1"], 4),
            "P99": round(v["p99"], 4), "Clipped": v["clipped"],
            "Clip %": round(v["clipped"] / max(clean_rows, 1) * 100, 3),
        } for col, v in clip_info.items()]
        clip_df = pd.DataFrame(clip_rows).sort_values("Clipped", ascending=False)
        heavy = int((clip_df["Clip %"] > 1).sum())
        st.dataframe(clip_df, use_container_width=True, height=280)
        st.markdown(insight_box(
            f"{total_clipped:,} total values clipped across all features. "
            f"{heavy} features had >1% rows clipped — heavy tail distributions. "
            "Clipping prevents outliers from dominating gradient updates during model training.",
            "warn" if heavy > 5 else "info",
        ), unsafe_allow_html=True)

    # ── Label consistency ──────────────────────────────────────────────────────
    st.markdown(section_header("Label Consistency Check"), unsafe_allow_html=True)
    if LABEL_COL in raw_df.columns:
        raw_label_vals = raw_df[LABEL_COL].astype(str)
        unique_raw = sorted(raw_label_vals.unique())
        ldf = pd.DataFrame({
            "Raw Label": unique_raw,
            "Stripped": [l.strip() for l in unique_raw],
            "Whitespace?": [l != l.strip() for l in unique_raw],
        })
        lc1, lc2 = st.columns(2)
        with lc1:
            st.dataframe(ldf, use_container_width=True, height=250)
        with lc2:
            ws_count = int(ldf["Whitespace?"].sum())
            if ws_count > 0:
                st.markdown(insight_box(
                    f"{ws_count} label values have whitespace. Stripped on load.",
                    "warn"), unsafe_allow_html=True)
            else:
                st.markdown(insight_box("All label values clean — no whitespace anomalies.", "success"),
                    unsafe_allow_html=True)
            for lbl in sorted(raw_label_vals.str.strip().unique()):
                cnt = int((df[LABEL_COL] == lbl).sum()) if LABEL_COL in df.columns else 0
                color = "#00f5ff" if lbl == "BENIGN" else "#ff2244"
                st.markdown(
                    f'<div style="padding:5px 10px; margin:3px 0; '
                    f'background:rgba(11,18,32,0.6); border-radius:6px; '
                    f'border-left:2px solid {color}; font-size:0.82rem; '
                    f'font-family:JetBrains Mono,monospace;">'
                    f'<span style="color:{color};">{lbl}</span>'
                    f'<span style="color:#3a5070; float:right;">{cnt:,}</span></div>',
                    unsafe_allow_html=True)

    # ── Memory usage ───────────────────────────────────────────────────────────
    st.markdown(section_header("Memory Usage"), unsafe_allow_html=True)
    raw_mb = round(raw_df.memory_usage(deep=True).sum() / 1024 ** 2, 2)
    clean_mb = round(df.memory_usage(deep=True).sum() / 1024 ** 2, 2)
    saved_pct = round((raw_mb - clean_mb) / max(raw_mb, 1) * 100, 1)
    mc1, mc2, mc3 = st.columns(3)
    mc1.markdown(metric_card("Raw Size", f"{raw_mb} MB", icon="💾"), unsafe_allow_html=True)
    mc2.markdown(metric_card("Clean Size", f"{clean_mb} MB", color=COLORS["accent2"], icon="✨"),
        unsafe_allow_html=True)
    mc3.markdown(metric_card("Saved", f"{saved_pct}%", color=COLORS["warning"], icon="📉"),
        unsafe_allow_html=True)
    st.markdown(insight_box(
        f"Cleaning reduced memory from {raw_mb} MB → {clean_mb} MB ({saved_pct}% reduction). "
        "Consider downcasting float64 → float32 to halve memory footprint in production.",
        "info",
    ), unsafe_allow_html=True)
