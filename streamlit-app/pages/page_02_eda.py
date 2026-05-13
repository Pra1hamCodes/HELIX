"""Page 2 — Exploratory Data Analysis."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card, get_attack_color,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import (
    apply_dark_theme, plotly_dark_layout, dark_fig,
    bar_class_distribution, pie_class_distribution,
    heatmap_corr, scatter_bivariate,
)


def _feature_stats(df: pd.DataFrame, num_cols: list[str]) -> pd.DataFrame:
    rows = []
    for col in num_cols:
        s = df[col]
        rows.append({
            "Feature": col,
            "Mean": round(float(s.mean()), 4),
            "Median": round(float(s.median()), 4),
            "Std": round(float(s.std()), 4),
            "Skewness": round(float(s.skew()), 4),
            "Kurtosis": round(float(s.kurtosis()), 4),
            "Min": round(float(s.min()), 4),
            "Max": round(float(s.max()), 4),
        })
    return pd.DataFrame(rows)


def render(df: pd.DataFrame):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("🔍 Exploratory Data Analysis",
        "Analyst-grade EDA — distributions, correlations, temporal patterns"), unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                if not c.startswith("_")]
    label_counts = df[LABEL_COL].value_counts()
    n_classes = len(label_counts)
    benign_pct = round(label_counts.get("BENIGN", 0) / max(len(df), 1) * 100, 1)
    top_col_var = df[num_cols].var().nlargest(1).index[0] if num_cols else "N/A"

    st.markdown(summary_card([
        f"{n_classes} attack classes found. BENIGN accounts for {benign_pct}% of all flows.",
        f"Dataset has {len(num_cols)} numeric features. Highest-variance feature: {top_col_var}.",
        f"Total: {len(df):,} cleaned flows across {df[SOURCE_COL].nunique() if SOURCE_COL in df.columns else '?'} day files.",
    ]), unsafe_allow_html=True)

    # ── Class distribution ──────────────────────────────────────────────────
    st.markdown(section_header("Class Distribution"), unsafe_allow_html=True)
    tcol1, tcol2 = st.columns([3, 2])
    with tcol1:
        fig_bar = bar_class_distribution(label_counts.sort_values(), "Flow Count by Attack Class")
        st.plotly_chart(fig_bar, use_container_width=True)
    with tcol2:
        fig_pie = pie_class_distribution(label_counts)
        st.plotly_chart(fig_pie, use_container_width=True)

    # Distribution table
    dist_df = pd.DataFrame({
        "Class": label_counts.index,
        "Count": label_counts.values,
        "% of Total": (label_counts.values / len(df) * 100).round(2),
        "Cumulative %": (label_counts.values / len(df) * 100).cumsum().round(2),
    })
    st.dataframe(dist_df, use_container_width=True, height=280)

    imbalance_ratio = label_counts.max() / max(label_counts.min(), 1)
    st.markdown(insight_box(
        f"Dataset is {'severely' if imbalance_ratio > 50 else 'moderately'} imbalanced "
        f"(ratio: {int(imbalance_ratio)}:1). BENIGN accounts for {benign_pct}% of flows. "
        "A naive classifier predicting BENIGN for everything would achieve ~"
        f"{benign_pct}% accuracy — F1 macro is the correct metric here.",
        "danger" if imbalance_ratio > 50 else "warn",
    ), unsafe_allow_html=True)

    # ── Per-class KDE ───────────────────────────────────────────────────────
    st.markdown(section_header("Per-Class Feature Distributions (KDE)",
        "Select a feature to see how each attack class differs"), unsafe_allow_html=True)
    sel_feat = st.selectbox("Feature", num_cols, key="kde_feat")

    fig_kde = go.Figure()
    for lbl in label_counts.index:
        sub = df[df[LABEL_COL] == lbl][sel_feat]
        if len(sub) < 2:
            continue
        from scipy.stats import gaussian_kde
        try:
            vals = sub.dropna().values
            kde = gaussian_kde(vals, bw_method="scott")
            x_range = np.linspace(vals.min(), vals.max(), 300)
            fig_kde.add_trace(go.Scatter(
                x=x_range, y=kde(x_range),
                name=lbl, fill="tozeroy",
                fillcolor=get_attack_color(lbl).replace("#", "rgba(") + ",0.12)",
                line=dict(color=get_attack_color(lbl), width=2),
            ))
        except Exception:
            pass
    plotly_dark_layout(fig_kde, f"KDE: {sel_feat} by Attack Class", h=380)
    st.plotly_chart(fig_kde, use_container_width=True)
    st.markdown(insight_box(
        f"Overlapping KDE curves for '{sel_feat}'. Classes whose KDE peaks are well-separated "
        "are distinguishable by this feature — making it a good candidate for the classifier.",
        "info",
    ), unsafe_allow_html=True)

    # ── Feature statistics table ─────────────────────────────────────────────
    st.markdown(section_header("Feature Statistics Table",
        "Sortable stats for all numeric features"), unsafe_allow_html=True)
    feat_stat_df = _feature_stats(df, num_cols[:80])

    def highlight_skew(val):
        try:
            return f"color: {COLORS['danger']}" if abs(float(val)) > 2 else ""
        except Exception:
            return ""

    styled_fs = feat_stat_df.style.applymap(highlight_skew, subset=["Skewness"])
    st.dataframe(styled_fs, use_container_width=True, height=350)
    high_skew = (feat_stat_df["Skewness"].abs() > 2).sum()
    st.markdown(insight_box(
        f"{high_skew} features have |skewness| > 2 (shown in red). "
        "Highly skewed features benefit from log-transform before ML. "
        "High kurtosis indicates heavy tails — outliers are present even after clipping.",
        "warn" if high_skew > 10 else "info",
    ), unsafe_allow_html=True)

    # ── Correlation heatmap ──────────────────────────────────────────────────
    st.markdown(section_header("Feature Correlation Analysis"), unsafe_allow_html=True)
    top_n = min(30, len(num_cols))
    top_var_cols = df[num_cols].var().nlargest(top_n).index.tolist()
    corr = df[top_var_cols].corr()
    fig_corr = heatmap_corr(corr, f"Pearson Correlation (Top {top_n} by Variance)")
    st.plotly_chart(fig_corr, use_container_width=True)

    # Top correlated pairs
    corr_pairs = []
    for i in range(len(corr.columns)):
        for j in range(i + 1, len(corr.columns)):
            r = corr.iloc[i, j]
            corr_pairs.append({"Feature A": corr.columns[i], "Feature B": corr.columns[j],
                                "Pearson r": round(float(r), 4)})
    pairs_df = pd.DataFrame(corr_pairs).sort_values("Pearson r", key=abs, ascending=False).head(20)
    st.write("**Top 20 Most Correlated Feature Pairs:**")
    st.dataframe(pairs_df, use_container_width=True, height=280)
    near_dup = (pairs_df["Pearson r"].abs() > 0.95).sum()
    st.markdown(insight_box(
        f"{near_dup} feature pairs have |r| > 0.95 — near-duplicate features. "
        "Keeping both adds noise without information. Consider removing one from each pair before modeling.",
        "warn" if near_dup > 0 else "success",
    ), unsafe_allow_html=True)

    # ── Bivariate scatter ────────────────────────────────────────────────────
    st.markdown(section_header("Bivariate Analysis",
        "Scatter plot of two features colored by attack class (5,000-row sample)"), unsafe_allow_html=True)
    bcol1, bcol2 = st.columns(2)
    with bcol1:
        x_feat = st.selectbox("X Feature", num_cols, index=0, key="biv_x")
    with bcol2:
        y_feat = st.selectbox("Y Feature", num_cols,
            index=min(1, len(num_cols) - 1), key="biv_y")

    fig_scatter = scatter_bivariate(df, x_feat, y_feat, LABEL_COL)
    st.plotly_chart(fig_scatter, use_container_width=True)
    st.caption("Computed on 5,000-row sample for performance.")
    st.markdown(insight_box(
        f"Scatter of {x_feat} vs {y_feat} colored by class. "
        "Well-separated clusters indicate these two features together separate attack types. "
        "Overlapping clusters mean the model will need additional features to discriminate.",
        "info",
    ), unsafe_allow_html=True)

    # ── Flow volume over time ────────────────────────────────────────────────
    st.markdown(section_header("Flow Volume Over Time"), unsafe_allow_html=True)
    if "Timestamp" in df.columns:
        try:
            ts = pd.to_datetime(df["Timestamp"], errors="coerce")
            df_ts = df.copy()
            df_ts["_ts"] = ts
            df_ts = df_ts.dropna(subset=["_ts"])
            df_ts["_minute"] = df_ts["_ts"].dt.floor("1min")
            vol = df_ts.groupby(["_minute", LABEL_COL]).size().reset_index(name="count")
            fig_ts = px.area(
                vol, x="_minute", y="count", color=LABEL_COL,
                color_discrete_map={l: get_attack_color(l) for l in vol[LABEL_COL].unique()},
                template="plotly_dark",
                title="Flows per Minute by Attack Type",
            )
            plotly_dark_layout(fig_ts, "Flows per Minute by Attack Type", h=380)
            st.plotly_chart(fig_ts, use_container_width=True)

            # Attack timeline
            st.write("**Attack Timeline:**")
            timeline = df_ts.groupby(LABEL_COL)["_ts"].agg(
                First_Seen="min", Last_Seen="max"
            ).reset_index()
            timeline["Duration (min)"] = ((timeline["Last_Seen"] - timeline["First_Seen"])
                                           .dt.total_seconds() / 60).round(1)
            st.dataframe(timeline, use_container_width=True)
        except Exception as e:
            st.markdown(insight_box(f"Timestamp parsing failed: {e}", "warn"), unsafe_allow_html=True)
    else:
        st.markdown(insight_box(
            "Timestamp column not found — temporal analysis skipped. "
            "CICIDS2017 files include a Timestamp column if loaded without column corruption.",
            "warn",
        ), unsafe_allow_html=True)

    # ── Skewness ranking ─────────────────────────────────────────────────────
    st.markdown(section_header("Feature Skewness Ranking"), unsafe_allow_html=True)
    skew_series = df[num_cols].skew().sort_values(key=abs, ascending=False).head(40)
    skew_colors = [COLORS["danger"] if abs(v) > 2 else COLORS["warning"] if abs(v) > 1 else COLORS["success"]
                   for v in skew_series.values]
    apply_dark_theme()
    fig_sk, ax_sk = plt.subplots(figsize=(12, 6))
    ax_sk.barh(skew_series.index[::-1], skew_series.values[::-1], color=skew_colors[::-1])
    ax_sk.axvline(0, color="#3a5070", linewidth=0.8)
    ax_sk.axvline(2, color=COLORS["warning"], linewidth=0.8, linestyle="--", label="|skew|=2")
    ax_sk.axvline(-2, color=COLORS["warning"], linewidth=0.8, linestyle="--")
    ax_sk.set_title("Feature Skewness (Top 40)", color="#cce8ff")
    ax_sk.legend(facecolor="#080d1a")
    fig_sk.patch.set_facecolor("#020409")
    plt.tight_layout()
    st.pyplot(fig_sk)
    plt.close(fig_sk)
    st.markdown(insight_box(
        f"{high_skew} features have |skewness| > 2. "
        "Recommendation: Apply log1p transform to these before ML training to improve model convergence.",
        "warn" if high_skew > 5 else "info",
    ), unsafe_allow_html=True)

    # ── Grid of histograms ───────────────────────────────────────────────────
    st.markdown(section_header("Univariate Distributions (Top 16 by Variance)",
        "Histogram + KDE overlay for highest-variance features"), unsafe_allow_html=True)
    top16 = df[num_cols].var().nlargest(16).index.tolist()
    apply_dark_theme()
    fig_grid, axes = plt.subplots(4, 4, figsize=(16, 12))
    fig_grid.patch.set_facecolor("#020409")
    for ax, col in zip(axes.flat, top16):
        vals = df[col].dropna().sample(min(3000, len(df)), random_state=42)
        ax.set_facecolor("#080d1a")
        ax.hist(vals, bins=50, color=COLORS["accent"], alpha=0.6, density=True)
        try:
            from scipy.stats import gaussian_kde
            kde_x = np.linspace(vals.min(), vals.max(), 200)
            ax.plot(kde_x, gaussian_kde(vals)(kde_x), color=COLORS["success"], lw=1.5)
        except Exception:
            pass
        ax.set_title(col[:22], color="#cce8ff", fontsize=8, pad=4)
        ax.tick_params(colors="#3a5070", labelsize=7)
        for spine in ax.spines.values():
            spine.set_edgecolor("rgba(0,245,255,0.1)")
    for ax in axes.flat[len(top16):]:
        ax.set_visible(False)
    plt.suptitle("Top 16 Feature Distributions", color="#cce8ff", fontsize=13, y=1.01)
    plt.tight_layout()
    st.pyplot(fig_grid)
    plt.close(fig_grid)
