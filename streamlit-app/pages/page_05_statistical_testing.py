"""Page 5 — Statistical Testing."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import apply_dark_theme, plotly_dark_layout
from utils.stats import (
    run_normality_batch, run_kruskal_batch, run_mw_batch,
    run_ks_batch, chi_squared_test,
)


def render(df: pd.DataFrame, file_names: list[str]):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("📐 Statistical Testing",
        "Validate findings with tests — not just plots"), unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not c.startswith("_")]
    top20 = df[num_cols].var().nlargest(20).index.tolist()

    st.markdown(summary_card([
        "Shapiro-Wilk confirms most network features are non-normal — non-parametric tests preferred.",
        "Kruskal-Wallis ranks features by discriminative power across all attack classes.",
        "KS test detects feature drift between days — use day-wise validation, not random splits.",
    ]), unsafe_allow_html=True)

    # ── Normality tests ───────────────────────────────────────────────────────
    st.markdown(section_header("Normality Tests (Shapiro-Wilk)",
        "Sample of 1,000 rows per feature. Most network features are NOT normal."), unsafe_allow_html=True)

    with st.spinner("Running Shapiro-Wilk on top 20 features…"):
        norm_df = run_normality_batch(df, top20, sample=1000)

    def color_normal(val):
        return (f"color: {'#00ff88'}" if val == "✓ Yes"
                else f"color: {COLORS['danger']}")

    styled_norm = norm_df.style.applymap(color_normal, subset=["Normal?"])
    st.dataframe(styled_norm, use_container_width=True, height=300)

    n_normal = (norm_df["Normal?"] == "✓ Yes").sum()
    st.markdown(insight_box(
        f"{n_normal}/{len(norm_df)} features are normally distributed (Shapiro-Wilk p > 0.05). "
        "Non-normal distributions → use non-parametric tests (Kruskal-Wallis, Mann-Whitney). "
        "Don't use ANOVA or Pearson correlation without log-transforming highly skewed features.",
        "warn" if n_normal < len(norm_df) // 2 else "info",
    ), unsafe_allow_html=True)

    # ── Kruskal-Wallis ─────────────────────────────────────────────────────────
    st.markdown(section_header("Kruskal-Wallis Test",
        "Does this feature differ across attack classes? High H = more useful."), unsafe_allow_html=True)

    with st.spinner("Running Kruskal-Wallis for all features…"):
        kw_df = run_kruskal_batch(df, num_cols[:60], LABEL_COL)

    def color_sig(val):
        return f"color: {'#00ff88'}" if val == "✓" else f"color: {COLORS['danger']}"

    styled_kw = kw_df.head(30).style.applymap(color_sig, subset=["Significant"])
    st.dataframe(styled_kw, use_container_width=True, height=350)

    significant_count = (kw_df["Significant"] == "✓").sum()
    top_kw = kw_df.iloc[0]
    st.markdown(insight_box(
        f"{significant_count}/{len(kw_df)} features show statistically significant differences "
        f"across attack classes (p < 0.05). "
        f"Top feature: {top_kw['Feature']} (H = {top_kw['H Statistic']:.2f}). "
        "High H-statistic → feature discriminates attack types → prioritize for modeling.",
        "info",
    ), unsafe_allow_html=True)

    # H statistic bar chart
    fig_kw = go.Figure(go.Bar(
        x=kw_df.head(25)["H Statistic"],
        y=kw_df.head(25)["Feature"],
        orientation="h",
        marker_color=COLORS["accent"],
    ))
    plotly_dark_layout(fig_kw, "Kruskal-Wallis H Statistic (Top 25 Features)", h=450)
    fig_kw.update_layout(yaxis=dict(autorange="reversed"))
    st.plotly_chart(fig_kw, use_container_width=True)

    # ── Mann-Whitney U ──────────────────────────────────────────────────────────
    st.markdown(section_header("Mann-Whitney U Test: BENIGN vs Attack",
        "Pairwise test per feature. Shows which features best separate benign vs attack."),
        unsafe_allow_html=True)

    with st.spinner("Running Mann-Whitney tests…"):
        mw_df = run_mw_batch(df, num_cols[:60], LABEL_COL, benign_label="BENIGN")

    st.dataframe(mw_df.head(25), use_container_width=True, height=320)

    top_mw = mw_df.iloc[0]
    top_mw_feat = top_mw['Feature']
    top_mw_cohens = top_mw["Cohen's d"] if "Cohen's d" in top_mw.index else 0.0
    st.markdown(insight_box(
        f"Top separator: {top_mw_feat} (Cohen's d = {top_mw_cohens:.3f}). "
        "Effect size |d| > 0.8 = large effect. "
        "These features are the most reliable for binary benign/attack detection.",
        "info",
    ), unsafe_allow_html=True)

    # ── Feature drift (KS test) ────────────────────────────────────────────────
    st.markdown(section_header("Feature Drift Detection (Kolmogorov-Smirnov)",
        "Compare feature distributions between two day files"), unsafe_allow_html=True)

    if SOURCE_COL in df.columns:
        files = sorted(df[SOURCE_COL].unique().tolist())
        if len(files) >= 2:
            kcol1, kcol2 = st.columns(2)
            with kcol1:
                file_a = st.selectbox("File A (reference)", files, index=0, key="ks_a")
            with kcol2:
                file_b = st.selectbox("File B (compare)", files, index=min(1, len(files) - 1), key="ks_b")

            if st.button("▶ Run KS Drift Test", key="ks_btn"):
                df_a = df[df[SOURCE_COL] == file_a]
                df_b = df[df[SOURCE_COL] == file_b]
                with st.spinner("Computing KS statistics…"):
                    ks_df = run_ks_batch(df_a, df_b, num_cols[:60])

                def color_drift(val):
                    return (f"color: {COLORS['danger']}" if "YES" in str(val)
                            else f"color: {'#00ff88'}")

                styled_ks = ks_df.style.applymap(color_drift, subset=["Drifted?"])
                st.dataframe(styled_ks, use_container_width=True, height=350)

                n_drifted = ks_df["Drifted?"].str.contains("YES").sum()

                # Bar chart
                fig_ks = go.Figure(go.Bar(
                    x=ks_df.head(25)["KS Statistic"],
                    y=ks_df.head(25)["Feature"],
                    orientation="h",
                    marker_color=[COLORS["danger"] if "YES" in d else COLORS["success"]
                                  for d in ks_df.head(25)["Drifted?"]],
                ))
                plotly_dark_layout(fig_ks, f"KS Statistic: {file_a} vs {file_b}", h=450)
                fig_ks.update_layout(yaxis=dict(autorange="reversed"))
                st.plotly_chart(fig_ks, use_container_width=True)

                st.markdown(insight_box(
                    f"{n_drifted}/{len(ks_df)} features show significant distribution drift "
                    f"between {file_a} and {file_b} (KS p < 0.05). "
                    "High drift = the model trained on Day A may not generalize to Day B. "
                    "Use day-wise cross-validation, not random splits.",
                    "danger" if n_drifted > len(ks_df) // 2 else "warn" if n_drifted > 0 else "success",
                ), unsafe_allow_html=True)

                # Distribution comparison for top drifted feature
                if len(ks_df) > 0:
                    top_drift_feat = ks_df.iloc[0]["Feature"]
                    st.write(f"**Distribution Comparison: {top_drift_feat}**")
                    fig_comp = go.Figure()
                    fig_comp.add_trace(go.Histogram(
                        x=df_a[top_drift_feat].dropna(),
                        name=file_a, opacity=0.7,
                        marker_color=COLORS["accent"], nbinsx=50,
                    ))
                    fig_comp.add_trace(go.Histogram(
                        x=df_b[top_drift_feat].dropna(),
                        name=file_b, opacity=0.7,
                        marker_color=COLORS["danger"], nbinsx=50,
                    ))
                    plotly_dark_layout(fig_comp, f"Distribution: {top_drift_feat}", h=350)
                    fig_comp.update_layout(barmode="overlay")
                    st.plotly_chart(fig_comp, use_container_width=True)
        else:
            st.markdown(insight_box(
                "Only one file loaded — drift analysis requires two different day files.",
                "warn",
            ), unsafe_allow_html=True)
    else:
        st.markdown(insight_box("Source file tracking not available.", "warn"), unsafe_allow_html=True)

    # ── Chi-squared ────────────────────────────────────────────────────────────
    st.markdown(section_header("Chi-Squared Test: Protocol vs Label"), unsafe_allow_html=True)

    proto_candidates = [c for c in df.columns if "protocol" in c.lower() or "Protocol" in c]
    if proto_candidates:
        proto_col = proto_candidates[0]
        res = chi_squared_test(df, proto_col, LABEL_COL)
        if res["chi2"] is not None:
            chicol1, chicol2 = st.columns(2)
            with chicol1:
                st.metric("Chi² Statistic", f"{res['chi2']:.2f}")
                st.metric("p-value", f"{res['p']:.2e}")
                st.metric("DoF", res["dof"])
            with chicol2:
                if res["contingency"] is not None:
                    st.write("**Contingency Table:**")
                    st.dataframe(res["contingency"], use_container_width=True, height=200)
            st.markdown(insight_box(
                f"Chi² = {res['chi2']:.2f}, p = {res['p']:.2e}. "
                f"{'Protocol type is significantly associated with attack label (p < 0.05).' if res['p'] < 0.05 else 'No significant association found.'} "
                "Protocol alone is not sufficient for detection, but it adds signal.",
                "info" if res["p"] < 0.05 else "warn",
            ), unsafe_allow_html=True)
    else:
        st.markdown(insight_box("No Protocol column found for chi-squared test.", "warn"), unsafe_allow_html=True)

    # ── Correlation stability across files ────────────────────────────────────
    st.markdown(section_header("Correlation Stability Across Days",
        "Features with stable correlation across days are reliable model inputs"), unsafe_allow_html=True)

    if SOURCE_COL in df.columns:
        files_all = sorted(df[SOURCE_COL].unique().tolist())
        top10 = df[num_cols].var().nlargest(10).index.tolist()
        binary_label = (df[LABEL_COL] != "BENIGN").astype(int)

        stability_rows = {}
        for f in files_all:
            sub = df[df[SOURCE_COL] == f]
            bl = (sub[LABEL_COL] != "BENIGN").astype(int)
            corrs = {}
            for col in top10:
                try:
                    from scipy.stats import pearsonr
                    if len(sub[col].dropna()) > 5 and bl.std() > 0:
                        r, _ = pearsonr(sub[col].fillna(0), bl)
                        corrs[col] = round(float(r), 4)
                    else:
                        corrs[col] = None
                except Exception:
                    corrs[col] = None
            stability_rows[f] = corrs

        stab_df = pd.DataFrame(stability_rows).T
        if not stab_df.empty:
            fig_stab = go.Figure(go.Heatmap(
                z=stab_df.values.tolist(),
                x=stab_df.columns.tolist(),
                y=[f[:20] for f in stab_df.index.tolist()],
                colorscale="RdBu",
                zmid=0,
                colorbar=dict(tickfont=dict(color="#cce8ff")),
            ))
            plotly_dark_layout(fig_stab, "Pearson r (Feature vs Attack Label) per Day", h=300)
            st.plotly_chart(fig_stab, use_container_width=True)

            corr_cv = stab_df.std() / (stab_df.abs().mean() + 1e-6)
            unstable = (corr_cv > 0.5).sum()
            st.markdown(insight_box(
                f"{unstable}/{len(top10)} top features show variable correlation across days "
                f"(coefficient of variation > 0.5). "
                "These features may be day-specific artifacts — avoid relying on them alone.",
                "warn" if unstable > 0 else "success",
            ), unsafe_allow_html=True)

    # ── Statistical summary report ────────────────────────────────────────────
    st.markdown(section_header("Statistical Summary Report"), unsafe_allow_html=True)

    if not kw_df.empty and not mw_df.empty:
        top_kw_feat = kw_df.iloc[0]["Feature"] if len(kw_df) > 0 else "N/A"
        top_mw_feat = mw_df.iloc[0]["Feature"] if len(mw_df) > 0 else "N/A"
        kw_H = kw_df.iloc[0]["H Statistic"] if len(kw_df) > 0 else 0
        kw_p = kw_df.iloc[0]["p-value"] if len(kw_df) > 0 else 1

        summary_text = f"""
**Automated Statistical Analysis Summary**

**Normality:** {n_normal}/{len(norm_df) if not norm_df.empty else '?'} features are normally distributed (Shapiro-Wilk, n=1000 sample).
Non-normal distribution in network flow features is expected — heavy tails from attack traffic.
**Recommendation:** Use Kruskal-Wallis and Mann-Whitney for hypothesis testing, not ANOVA/t-test.

**Discriminative Features (Kruskal-Wallis):** {significant_count}/{len(kw_df) if not kw_df.empty else '?'} features significantly differ across attack classes.
Feature '{top_kw_feat}' is the strongest discriminator (H = {kw_H:.2f}, p = {kw_p:.2e}).
**Recommendation:** These {significant_count} features should be prioritized in feature selection.

**Benign vs Attack Separation (Mann-Whitney):** Feature '{top_mw_feat}' provides the strongest
separation between BENIGN and attack traffic.
**Recommendation:** Use this as a first-stage filter in a two-stage classifier.

**Drift Analysis:** Run KS tests between consecutive day files before deployment.
Models should be retrained when KS > 0.3 on top features (indicates distribution shift).
        """
        st.markdown(
            f'<div style="background:{"#080d1a"};border:1px solid {"rgba(0,245,255,0.1)"};'
            f'border-radius:10px;padding:20px;font-size:0.9rem;line-height:1.7;">{summary_text}</div>',
            unsafe_allow_html=True,
        )
        st.download_button(
            "⬇ Download Statistical Report",
            summary_text,
            file_name="cicids_statistical_report.txt",
            mime="text/plain",
        )
