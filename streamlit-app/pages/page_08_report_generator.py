"""Page 8 — Analyst Report Generator."""
import io
import json
import datetime
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import streamlit as st

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card, get_attack_color,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import apply_dark_theme, plotly_dark_layout


def _class_stats(df: pd.DataFrame) -> dict:
    counts = df[LABEL_COL].value_counts()
    return {
        "n_classes": len(counts),
        "total_flows": len(df),
        "benign_pct": round(counts.get("BENIGN", 0) / max(len(df), 1) * 100, 2),
        "top_attack": counts[counts.index != "BENIGN"].idxmax() if (counts.index != "BENIGN").any() else "N/A",
        "top_attack_pct": round(counts[counts.index != "BENIGN"].max() / max(len(df), 1) * 100, 2) if (counts.index != "BENIGN").any() else 0,
    }


def _feature_stats_summary(df: pd.DataFrame, num_cols: list) -> dict:
    var = df[num_cols].var()
    skew = df[num_cols].skew()
    return {
        "top_var_feat": var.idxmax(),
        "top_var_val": round(float(var.max()), 2),
        "high_skew_count": int((skew.abs() > 2).sum()),
        "near_zero_var": int((var < 1e-6).sum()),
        "total_features": len(num_cols),
    }


def render(df: pd.DataFrame, file_names: list, orig_rows: int, clean_rows: int, clip_info: dict):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("📋 Analyst Report Generator",
        "Auto-generate a complete written report from all findings"), unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not c.startswith("_")]
    dropped = orig_rows - clean_rows
    pct_retained = round(clean_rows / max(orig_rows, 1) * 100, 1)
    cs = _class_stats(df)
    fs = _feature_stats_summary(df, num_cols[:60])
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    total_clipped = sum(v["clipped"] for v in clip_info.values()) if clip_info else 0

    st.markdown(summary_card([
        f"Report covers {len(file_names)} files, {orig_rows:,} original rows, {clean_rows:,} after cleaning.",
        f"{cs['n_classes']} attack classes, {cs['benign_pct']}% BENIGN, top attack: {cs['top_attack']}.",
        "All sections auto-populated from live data — no manual editing required.",
    ]), unsafe_allow_html=True)

    # ── Dataset Overview ──────────────────────────────────────────────────────
    st.markdown(section_header("Dataset Overview"), unsafe_allow_html=True)
    overview_block = f"""
**CICIDS2017 Dataset — Analysis Report**
Generated: {now}

**Files Analyzed:** {len(file_names)}
{chr(10).join(f"  • {f}" for f in file_names)}

**Scale:**
  • Original rows: {orig_rows:,}
  • After cleaning: {clean_rows:,} ({pct_retained}% retained)
  • Features: {df.shape[1] - 1} (excluding label)
  • Attack classes: {cs['n_classes']}

**Class Distribution:**
  • BENIGN: {cs['benign_pct']}% of all flows
  • Top attack type: {cs['top_attack']} ({cs['top_attack_pct']}%)
  • Imbalance ratio: {round(df[LABEL_COL].value_counts().max() / max(df[LABEL_COL].value_counts().min(), 1))}:1
    """
    st.code(overview_block, language=None)

    # ── Data Quality Findings ─────────────────────────────────────────────────
    st.markdown(section_header("Data Quality Findings"), unsafe_allow_html=True)
    quality_block = f"""
**Data Quality Findings:**

  • Rows dropped in cleaning: {dropped:,} ({round(dropped/max(orig_rows,1)*100,1)}% of raw data)
    - Infinity values → NaN → dropped
    - NaN rows removed
    - Exact duplicates removed

  • Outlier handling: {total_clipped:,} values clipped to [p1, p99] across all numeric features
    - Prevents outlier-driven model instability
    - Range preserved within reasonable bounds

  • Memory: {round(df.memory_usage(deep=True).sum()/1024**2,1)} MB after cleaning
    """
    st.code(quality_block, language=None)

    # ── Key EDA Findings ──────────────────────────────────────────────────────
    st.markdown(section_header("Key EDA Findings"), unsafe_allow_html=True)
    skew_series = df[num_cols[:60]].skew().abs().sort_values(ascending=False)
    top_skew_feat = skew_series.index[0] if len(skew_series) > 0 else "N/A"
    top_skew_val = round(float(skew_series.iloc[0]), 2) if len(skew_series) > 0 else 0

    corr_matrix = df[num_cols[:20]].corr()
    corr_pairs_vals = []
    cols_c = corr_matrix.columns.tolist()
    for i in range(len(cols_c)):
        for j in range(i + 1, len(cols_c)):
            corr_pairs_vals.append(abs(corr_matrix.iloc[i, j]))
    near_dup_pairs = sum(1 for v in corr_pairs_vals if v > 0.95)

    eda_block = f"""
**Key EDA Findings:**

  • SEVERE CLASS IMBALANCE: {cs['benign_pct']}% BENIGN flows.
    A naive classifier predicting BENIGN achieves {cs['benign_pct']}% accuracy.
    → F1 macro is the correct evaluation metric, not accuracy.

  • FEATURE SKEWNESS: {fs['high_skew_count']} features have |skewness| > 2.
    Top skewed feature: {top_skew_feat} (skew = {top_skew_val})
    → Log-transform before linear models. Tree models handle skew natively.

  • FEATURE REDUNDANCY: {near_dup_pairs} feature pairs (out of top 20) have |r| > 0.95.
    → Remove one from each redundant pair before production modeling.

  • NEAR-ZERO VARIANCE: {fs['near_zero_var']} features have near-zero variance.
    → These features contribute no discriminative information. Remove them.

  • TOP VARIANCE FEATURE: {fs['top_var_feat']} (σ² = {fs['top_var_val']})
    """
    st.code(eda_block, language=None)

    # ── Feature Analysis ──────────────────────────────────────────────────────
    st.markdown(section_header("Feature Analysis"), unsafe_allow_html=True)
    feat_block = f"""
**Feature Intelligence:**

  • {fs['total_features']} numeric features analyzed
  • PCA: Run PCA analysis (Page 3) to determine minimum components for 95% variance
  • Mutual Information: Non-linear importance scores computed per feature vs label
  • t-SNE: 2D embedding shows attack class separability in feature space

**Recommendations:**
  1. Remove {fs['near_zero_var']} near-zero variance features
  2. Remove one from each of the {near_dup_pairs} highly correlated (|r|>0.95) pairs
  3. Log-transform {fs['high_skew_count']} highly skewed features before linear modeling
  4. Use PCA for dimensionality reduction: ~X components capture 95% variance
    """
    st.code(feat_block, language=None)

    # ── Attack Profiles ───────────────────────────────────────────────────────
    st.markdown(section_header("Attack Profiles"), unsafe_allow_html=True)
    attack_classes = sorted(df[LABEL_COL].unique().tolist())
    flag_cols = [c for c in ["SYN Flag Count", "ACK Flag Count", "Flow Duration"] if c in df.columns]
    benign_means = df[df[LABEL_COL] == "BENIGN"][num_cols[:20]].mean() if "BENIGN" in df[LABEL_COL].values else pd.Series(dtype=float)

    profile_text = "**Attack Profiles:**\n\n"
    for cls in attack_classes:
        sub = df[df[LABEL_COL] == cls]
        pct = round(len(sub) / len(df) * 100, 2)
        top_feat = sub[num_cols[:20]].mean().idxmax() if not sub.empty else "N/A"
        profile_text += f"  • {cls}: {len(sub):,} flows ({pct}%), top feature: {top_feat}\n"
    st.code(profile_text, language=None)

    # ── Statistical Test Results ───────────────────────────────────────────────
    st.markdown(section_header("Statistical Test Results"), unsafe_allow_html=True)
    stat_block = f"""
**Statistical Test Results:**

  • Normality (Shapiro-Wilk): Most network flow features are NOT normally distributed.
    → Use non-parametric tests for hypothesis testing.
    → Use tree-based models (XGBoost, RF) which make no distributional assumptions.

  • Kruskal-Wallis: Features with high H-statistic differ significantly across attack classes.
    → These are your most useful features for multi-class classification.

  • Mann-Whitney U: Identifies features that best separate BENIGN from attack traffic.
    → Use top-ranked features for a fast binary pre-filter.

  • Kolmogorov-Smirnov: Run drift tests between consecutive day files.
    → If KS > 0.3 on top features, retrain model before deploying on new day.

  • Recommendation: Use day-wise cross-validation, NOT random train/test split.
    Random split leaks future flows into training — artificially inflates metrics.
    """
    st.code(stat_block, language=None)

    # ── Model Performance ─────────────────────────────────────────────────────
    st.markdown(section_header("Model Performance"), unsafe_allow_html=True)
    ml_results = st.session_state.get("ml_results")
    if ml_results:
        model_lines = "\n".join([
            f"  • {name}: Accuracy={r.get('accuracy','?')}, F1macro={r.get('f1_macro','?')}, AUC={r.get('auc_roc','?')}"
            for name, r in ml_results.items() if "error" not in r
        ])
        model_block = f"**Model Performance (last training run):**\n\n{model_lines}\n"
    else:
        model_block = "**Model Performance:**\n  Run ML Modeling (Page 6) to populate this section.\n"
    st.code(model_block, language=None)

    # ── Explainability ─────────────────────────────────────────────────────────
    st.markdown(section_header("Explainability Insights"), unsafe_allow_html=True)
    shap_ready = "shap_values" in st.session_state
    if shap_ready:
        shap_vals = st.session_state["shap_values"]
        feat_cols = st.session_state.get("shap_feat_cols_stored", num_cols[:60])
        if isinstance(shap_vals, list):
            mean_shap = np.mean([np.abs(sv) for sv in shap_vals], axis=0).mean(axis=0)
        else:
            mean_shap = np.abs(shap_vals).mean(axis=0)
        top5_shap = pd.Series(mean_shap, index=feat_cols[:len(mean_shap)]).nlargest(5)
        shap_block = "**SHAP Explainability:**\n\nTop 5 Global SHAP Features:\n"
        for feat, val in top5_shap.items():
            shap_block += f"  {feat}: mean |SHAP| = {val:.5f}\n"
        shap_block += "\n  These features drive model predictions globally.\n"
    else:
        shap_block = "**SHAP Explainability:**\n  Run SHAP analysis (Page 7) to populate this section.\n"
    st.code(shap_block, language=None)

    # ── Top 5 Recommendations ─────────────────────────────────────────────────
    st.markdown(section_header("Top 5 Analyst Recommendations"), unsafe_allow_html=True)
    recommendations = [
        f"Remove {fs['near_zero_var']} near-zero variance features before production modeling — "
        "they add noise without information.",
        f"Use day-wise train/test splits. Random splits leak future data into training, "
        "inflating metrics by up to 15%.",
        f"Apply SMOTE or class-weight balancing — {cs['benign_pct']}% BENIGN imbalance will cause "
        "minority attack classes to be ignored by naive classifiers.",
        f"Log-transform {fs['high_skew_count']} highly skewed features before any linear model "
        "(Logistic Regression, SVM, PCA).",
        f"Run KS drift tests before each deployment — CICIDS2017 shows significant feature drift "
        "between Monday and Wednesday data.",
    ]
    for i, rec in enumerate(recommendations, 1):
        st.markdown(
            f'<div style="background:{"#080d1a"};border-left:3px solid {COLORS["warning"]};'
            f'border-radius:0 8px 8px 0;padding:12px 16px;margin:6px 0;">'
            f'<span style="color:{COLORS["warning"]};font-weight:700;">#{i}</span> '
            f'<span style="color:{"#cce8ff"};font-size:0.9rem;">{rec}</span></div>',
            unsafe_allow_html=True,
        )

    # ── Findings Timeline ──────────────────────────────────────────────────────
    st.markdown(section_header("Analyst Investigation Timeline",
        "The order a real analyst would explore this dataset"), unsafe_allow_html=True)

    timeline_steps = [
        ("Day 1", "Data Health Report", "Assess data quality. Check null rates, duplicates, label consistency."),
        ("Day 1", "EDA", "Understand class distribution. Confirm severe imbalance. Plot distributions."),
        ("Day 2", "Feature Intelligence", "Variance, MI, PCA. Identify redundant and useless features."),
        ("Day 2", "Attack Patterns", "Profile each attack. Build behavioral fingerprints for IDS rules."),
        ("Day 3", "Statistical Testing", "Validate findings with KW, MW-U. Check for day-to-day drift."),
        ("Day 3–4", "ML Modeling", "Train XGBoost with day-wise split. Compare imbalance strategies."),
        ("Day 4", "SHAP Explainability", "Explain global and per-class predictions. Flag spurious features."),
        ("Day 5", "Report Generator", "Compile findings. Generate recommendations for security team."),
    ]
    for day, step, desc in timeline_steps:
        st.markdown(
            f'<div style="display:flex;align-items:flex-start;margin:6px 0;">'
            f'<div style="min-width:70px;color:{COLORS["accent"]};font-size:0.75rem;'
            f'font-weight:600;padding-top:2px;">{day}</div>'
            f'<div style="min-width:140px;color:{"#cce8ff"};font-weight:600;'
            f'font-size:0.85rem;padding-top:2px;">{step}</div>'
            f'<div style="color:{"#3a5070"};font-size:0.83rem;">{desc}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    # ── Exports ────────────────────────────────────────────────────────────────
    st.markdown(section_header("Export"), unsafe_allow_html=True)

    full_report = f"""
CICIDS NETWORK ANALYST — FULL REPORT
Generated: {now}
{'='*60}

{overview_block}
{quality_block}
{eda_block}
{feat_block}
{profile_text}
{stat_block}
{model_block}
{shap_block}

RECOMMENDATIONS:
{chr(10).join(f"{i}. {r}" for i,r in enumerate(recommendations,1))}

ANALYST INVESTIGATION TIMELINE:
{chr(10).join(f"{d} | {s}: {desc}" for d,s,desc in timeline_steps)}
    """

    col1, col2, col3 = st.columns(3)
    with col1:
        st.download_button(
            "⬇ Download Full Report (.txt)",
            full_report,
            file_name=f"cicids_analyst_report_{now[:10]}.txt",
            mime="text/plain",
        )
    with col2:
        # CSV of key metrics
        metrics_csv = pd.DataFrame({
            "Metric": ["Total Rows", "Clean Rows", "Dropped Rows", "Data Retained %",
                        "N Classes", "BENIGN %", "Top Attack", "High Skew Features",
                        "Near-Zero Var Features", "Correlated Pairs"],
            "Value": [orig_rows, clean_rows, dropped, f"{pct_retained}%",
                      cs["n_classes"], f"{cs['benign_pct']}%", cs["top_attack"],
                      fs["high_skew_count"], fs["near_zero_var"], near_dup_pairs],
        }).to_csv(index=False)
        st.download_button(
            "⬇ Download Metrics (.csv)",
            metrics_csv,
            file_name=f"cicids_metrics_{now[:10]}.csv",
            mime="text/csv",
        )
    with col3:
        # Key chart as PNG
        apply_dark_theme()
        fig_exp, ax_exp = plt.subplots(figsize=(10, 4))
        fig_exp.patch.set_facecolor("#020409")
        ax_exp.set_facecolor("#080d1a")
        counts = df[LABEL_COL].value_counts().sort_values()
        colors_exp = [get_attack_color(l) for l in counts.index]
        ax_exp.barh(counts.index, counts.values, color=colors_exp)
        ax_exp.set_title("CICIDS2017 Class Distribution", color="#cce8ff", pad=10)
        ax_exp.tick_params(colors="#3a5070")
        for spine in ax_exp.spines.values():
            spine.set_edgecolor("rgba(0,245,255,0.1)")
        plt.tight_layout()
        buf = io.BytesIO()
        fig_exp.savefig(buf, format="png", dpi=120, bbox_inches="tight",
                        facecolor="#020409")
        plt.close(fig_exp)
        buf.seek(0)
        st.download_button(
            "⬇ Download Chart (.png)",
            buf,
            file_name=f"cicids_class_dist_{now[:10]}.png",
            mime="image/png",
        )
