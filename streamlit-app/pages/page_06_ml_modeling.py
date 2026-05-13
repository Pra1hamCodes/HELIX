"""Page 6 — ML Modeling & Evaluation."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st
from sklearn.preprocessing import StandardScaler, LabelEncoder
import warnings
warnings.filterwarnings("ignore")

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card, get_attack_color,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import apply_dark_theme, plotly_dark_layout, roc_curve_plot, confusion_matrix_plot
from utils.ml import (
    prepare_features, day_split, train_models_comparison,
    compute_roc_curves, compute_pr_curves, compute_learning_curve,
)


def render(df: pd.DataFrame):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("🤖 ML Modeling & Evaluation",
        "End-to-end ML pipeline with proper day-wise splits and imbalance handling"),
        unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    st.markdown(summary_card([
        "Day-wise train/test split prevents data leakage — last day file is held out as test.",
        "XGBoost, Random Forest, Logistic Regression compared on same split.",
        "SMOTE, class weights, and undersampling strategies compared for imbalance handling.",
    ]), unsafe_allow_html=True)

    # ── Preprocessing pipeline display ────────────────────────────────────────
    st.markdown(section_header("Preprocessing Pipeline"), unsafe_allow_html=True)

    steps = [
        ("1. Feature Selection", f"Select {len([c for c in df.select_dtypes(include=[np.number]).columns if not c.startswith('_')])} numeric features, exclude Label/Timestamp/_source"),
        ("2. Label Encoding", "LabelEncoder: attack class strings → integers"),
        ("3. Day-wise Split", f"Train = {df[SOURCE_COL].nunique() - 1 if SOURCE_COL in df.columns else '?'} days, Test = last day file"),
        ("4. StandardScaler", "Fit on train, transform both train and test"),
        ("5. Imbalance Handling", "Option: raw / class_weight / SMOTE / undersample"),
        ("6. Training", "XGBoost (200 trees) | RandomForest (150 trees) | LogisticRegression"),
        ("7. Evaluation", "Accuracy, Precision, Recall, F1 macro/weighted, AUC-ROC"),
    ]
    for step, desc in steps:
        st.markdown(
            f'<div style="background:{"#080d1a"};border-left:3px solid {COLORS["accent"]};'
            f'border-radius:0 6px 6px 0;padding:10px 14px;margin:4px 0;">'
            f'<span style="color:{COLORS["accent"]};font-weight:600;">{step}:</span> '
            f'<span style="color:{"#cce8ff"};font-size:0.88rem;">{desc}</span></div>',
            unsafe_allow_html=True,
        )

    # ── Model training button ─────────────────────────────────────────────────
    st.markdown(section_header("Model Training"), unsafe_allow_html=True)

    strategy = st.radio("Imbalance Strategy", ["raw", "class_weight", "smote", "undersample"],
                        horizontal=True, key="ml_strategy")
    sample_size = st.slider("Training sample size (rows, 0 = all)",
                            min_value=0, max_value=min(100000, len(df)), value=min(50000, len(df)),
                            step=5000, key="ml_sample")

    if st.button("▶ Train & Evaluate All Models", key="train_btn"):
        # Sample if needed
        work_df = df.sample(sample_size, random_state=42) if 0 < sample_size < len(df) else df

        with st.spinner("Splitting by day…"):
            train_df, test_df = day_split(work_df)

        st.markdown(
            f'<div style="color:{"#3a5070"};font-size:0.82rem;margin-bottom:8px;">'
            f'Train: {len(train_df):,} rows | Test: {len(test_df):,} rows</div>',
            unsafe_allow_html=True,
        )

        with st.spinner(f"Training models with strategy={strategy}… (may take 1–3 minutes)"):
            results = train_models_comparison(train_df, test_df, strategy=strategy)

        st.session_state["ml_results"] = results
        st.session_state["ml_train_df"] = train_df
        st.session_state["ml_test_df"] = test_df
        st.success("Training complete!")

    results = st.session_state.get("ml_results")
    if not results:
        st.markdown(insight_box("Click 'Train & Evaluate All Models' to start.", "info"),
            unsafe_allow_html=True)
        return

    # ── Model comparison table ────────────────────────────────────────────────
    st.markdown(section_header("Model Comparison"), unsafe_allow_html=True)

    metrics_rows = []
    for model_name, res in results.items():
        if "error" in res:
            metrics_rows.append({"Model": model_name, "Error": res["error"]})
        else:
            metrics_rows.append({
                "Model": model_name,
                "Accuracy": res["accuracy"],
                "Precision (macro)": res["precision_macro"],
                "Recall (macro)": res["recall_macro"],
                "F1 (macro)": res["f1_macro"],
                "F1 (weighted)": res["f1_weighted"],
                "AUC-ROC": res.get("auc_roc", "N/A"),
            })

    if metrics_rows and "Error" not in metrics_rows[0]:
        comp_df = pd.DataFrame(metrics_rows)
        best_f1 = comp_df.loc[comp_df["F1 (macro)"].idxmax(), "Model"]

        def highlight_best(s):
            is_max = s == s.max()
            return [f"background-color: rgba(63,185,80,0.15); color: {'#00ff88'}"
                    if v else "" for v in is_max]

        styled_comp = comp_df.style.apply(
            highlight_best,
            subset=["Accuracy", "Precision (macro)", "Recall (macro)", "F1 (macro)", "F1 (weighted)"]
        )
        st.dataframe(styled_comp, use_container_width=True, height=160)
        st.markdown(insight_box(
            f"Best model by F1 macro: {best_f1}. "
            "F1 macro is the correct metric here — it treats each class equally regardless of size. "
            "Accuracy can be misleading (BENIGN dominance). AUC-ROC shows overall discrimination.",
            "success",
        ), unsafe_allow_html=True)

    # Select model for detailed view
    valid_models = [m for m, r in results.items() if "error" not in r]
    if not valid_models:
        st.error("No models trained successfully.")
        return

    sel_model = st.selectbox("Select model for detailed analysis", valid_models, key="sel_model")
    res = results[sel_model]

    # ── Confusion matrix ──────────────────────────────────────────────────────
    st.markdown(section_header("Confusion Matrix"), unsafe_allow_html=True)
    fig_cm = confusion_matrix_plot(res["confusion_matrix"], res["labels"])
    st.plotly_chart(fig_cm, use_container_width=True)
    st.markdown(insight_box(
        "Diagonal = correct predictions. Off-diagonal = misclassifications. "
        "Large off-diagonal values in minority attack classes indicate the model struggles there. "
        "Consider per-class SMOTE or cost-sensitive training.",
        "info",
    ), unsafe_allow_html=True)

    # ── Per-class metrics ─────────────────────────────────────────────────────
    st.markdown(section_header("Per-Class Precision / Recall / F1"), unsafe_allow_html=True)

    per_cls = []
    for cls, d in res["report"].items():
        if isinstance(d, dict) and "f1-score" in d:
            per_cls.append({
                "Class": cls,
                "Precision": round(d["precision"], 4),
                "Recall": round(d["recall"], 4),
                "F1": round(d["f1-score"], 4),
                "Support": int(d["support"]),
            })
    if per_cls:
        pcls_df = pd.DataFrame(per_cls)
        fig_pcls = go.Figure()
        for metric, color in [("Precision", COLORS["accent"]),
                               ("Recall", COLORS["success"]),
                               ("F1", COLORS["warning"])]:
            fig_pcls.add_trace(go.Bar(
                name=metric,
                x=pcls_df["Class"],
                y=pcls_df[metric],
                marker_color=color,
            ))
        plotly_dark_layout(fig_pcls, f"{sel_model} — Per-Class Metrics", h=420)
        fig_pcls.update_layout(barmode="group",
            xaxis=dict(tickangle=-35, tickfont=dict(size=10)))
        st.plotly_chart(fig_pcls, use_container_width=True)

        worst_cls = pcls_df.loc[pcls_df["F1"].idxmin()]
        st.markdown(insight_box(
            f"Weakest class: {worst_cls['Class']} (F1 = {worst_cls['F1']:.3f}). "
            "Low recall on minority attack classes is the main challenge. "
            "Consider per-class oversampling (SMOTE) to boost recall on underrepresented attacks.",
            "warn" if worst_cls["F1"] < 0.5 else "info",
        ), unsafe_allow_html=True)

    # ── ROC curves ────────────────────────────────────────────────────────────
    st.markdown(section_header("ROC Curves (One-vs-Rest per Class)"), unsafe_allow_html=True)

    if res.get("y_prob") is not None:
        le = LabelEncoder()
        le.classes_ = np.array(res["labels"])
        fpr_d, tpr_d, auc_d = compute_roc_curves(res["y_test"], res["y_prob"], le)
        if fpr_d:
            fig_roc = roc_curve_plot(fpr_d, tpr_d, auc_d)
            st.plotly_chart(fig_roc, use_container_width=True)

        # PR curves
        st.markdown(section_header("Precision-Recall Curves",
            "Critical for imbalanced data — AUC-PR > ROC-AUC in importance here"), unsafe_allow_html=True)
        prec_d, rec_d, auc_pr = compute_pr_curves(res["y_test"], res["y_prob"], le)
        if prec_d:
            fig_pr = go.Figure()
            for cls in prec_d:
                fig_pr.add_trace(go.Scatter(
                    x=rec_d[cls], y=prec_d[cls],
                    name=f"{cls} (AP={auc_pr[cls]:.3f})",
                    line=dict(color=get_attack_color(cls), width=2),
                    mode="lines",
                ))
            plotly_dark_layout(fig_pr, "Precision-Recall Curves", h=420)
            fig_pr.update_layout(xaxis_title="Recall", yaxis_title="Precision")
            st.plotly_chart(fig_pr, use_container_width=True)
    else:
        st.markdown(insight_box("Probability estimates not available for selected model.", "warn"),
            unsafe_allow_html=True)

    # ── Threshold analysis ─────────────────────────────────────────────────────
    st.markdown(section_header("Decision Threshold Analysis (Binary: Benign vs Attack)"),
        unsafe_allow_html=True)

    if res.get("y_prob") is not None and len(res["labels"]) >= 2:
        y_bin = (res["y_test"] > 0).astype(int)
        # probability of being attack (non-BENIGN) = 1 - P(BENIGN)
        benign_idx = list(res["labels"]).index("BENIGN") if "BENIGN" in res["labels"] else 0
        p_attack = 1 - res["y_prob"][:, benign_idx]

        thresholds = np.linspace(0.05, 0.95, 50)
        prec_t, rec_t, f1_t = [], [], []
        from sklearn.metrics import precision_score, recall_score, f1_score
        for t in thresholds:
            pred = (p_attack >= t).astype(int)
            prec_t.append(precision_score(y_bin, pred, zero_division=0))
            rec_t.append(recall_score(y_bin, pred, zero_division=0))
            f1_t.append(f1_score(y_bin, pred, zero_division=0))

        fig_thresh = go.Figure()
        fig_thresh.add_trace(go.Scatter(x=thresholds, y=prec_t, name="Precision",
                                        line=dict(color=COLORS["accent"], width=2)))
        fig_thresh.add_trace(go.Scatter(x=thresholds, y=rec_t, name="Recall",
                                        line=dict(color=COLORS["success"], width=2)))
        fig_thresh.add_trace(go.Scatter(x=thresholds, y=f1_t, name="F1",
                                        line=dict(color=COLORS["warning"], width=2)))
        plotly_dark_layout(fig_thresh, "Threshold vs Precision / Recall / F1", h=380)
        fig_thresh.update_layout(xaxis_title="Decision Threshold",
                                  yaxis_title="Score", yaxis_range=[0, 1])
        st.plotly_chart(fig_thresh, use_container_width=True)
        best_thresh = thresholds[np.argmax(f1_t)]
        st.markdown(insight_box(
            f"Optimal threshold by F1: {best_thresh:.2f}. "
            "Lowering threshold → more detections (higher recall) but more false alarms. "
            "In security, recall (catching attacks) typically outweighs precision.",
            "info",
        ), unsafe_allow_html=True)

    # ── Learning curves ────────────────────────────────────────────────────────
    st.markdown(section_header("Learning Curves",
        "Train vs validation F1 as training size increases"), unsafe_allow_html=True)

    if st.button("▶ Compute Learning Curves (slow)", key="lc_btn"):
        train_df_s = st.session_state.get("ml_train_df")
        if train_df_s is not None:
            X_lc, y_lc, le_lc, _ = prepare_features(train_df_s)
            scaler_lc = StandardScaler()
            X_lc = scaler_lc.fit_transform(X_lc)

            best_model = results[valid_models[0]]["model"]
            with st.spinner("Computing learning curves…"):
                try:
                    sizes, tr_sc, val_sc = compute_learning_curve(best_model, X_lc, y_lc, cv=3)
                    fig_lc = go.Figure()
                    fig_lc.add_trace(go.Scatter(x=sizes, y=tr_sc, name="Train F1",
                        line=dict(color=COLORS["accent"], width=2)))
                    fig_lc.add_trace(go.Scatter(x=sizes, y=val_sc, name="Val F1",
                        line=dict(color=COLORS["success"], width=2)))
                    plotly_dark_layout(fig_lc, "Learning Curves (F1 macro)", h=380)
                    fig_lc.update_layout(xaxis_title="Training Size", yaxis_title="F1 macro")
                    st.plotly_chart(fig_lc, use_container_width=True)
                    gap = tr_sc[-1] - val_sc[-1]
                    st.markdown(insight_box(
                        f"Train F1: {tr_sc[-1]:.3f}, Val F1: {val_sc[-1]:.3f} (gap: {gap:.3f}). "
                        f"{'High gap → overfitting. Try reducing tree depth or adding regularization.' if gap > 0.1 else 'Small gap → good generalization.'} "
                        f"{'Val F1 still rising → more data would help.' if val_sc[-1] > val_sc[-2] else 'Val F1 plateaued → more data will not help much.'}",
                        "warn" if gap > 0.1 else "success",
                    ), unsafe_allow_html=True)
                except Exception as e:
                    st.markdown(insight_box(f"Learning curve failed: {e}", "danger"), unsafe_allow_html=True)

    # ── Imbalance strategy comparison ─────────────────────────────────────────
    st.markdown(section_header("Imbalance Strategy Comparison"), unsafe_allow_html=True)

    if st.button("▶ Compare All 4 Imbalance Strategies (slow)", key="imb_btn"):
        train_df_s = st.session_state.get("ml_train_df")
        test_df_s = st.session_state.get("ml_test_df")
        if train_df_s is not None and test_df_s is not None:
            strat_results = {}
            for strat in ["raw", "class_weight", "smote", "undersample"]:
                with st.spinner(f"Training with {strat}…"):
                    r = train_models_comparison(train_df_s, test_df_s, strategy=strat)
                    # Take best model by f1_macro
                    best_r = max(
                        {k: v for k, v in r.items() if "error" not in v}.values(),
                        key=lambda x: x.get("f1_macro", 0),
                        default=None,
                    )
                    if best_r:
                        strat_results[strat] = best_r["f1_macro"]

            if strat_results:
                fig_strat = go.Figure(go.Bar(
                    x=list(strat_results.keys()),
                    y=list(strat_results.values()),
                    marker_color=[COLORS["accent"], COLORS["success"], COLORS["warning"], COLORS["danger"]],
                    text=[f"{v:.4f}" for v in strat_results.values()],
                    textposition="outside",
                ))
                plotly_dark_layout(fig_strat, "F1 Macro by Imbalance Strategy (Best Model)", h=350)
                best_strat = max(strat_results, key=strat_results.get)
                st.plotly_chart(fig_strat, use_container_width=True)
                st.markdown(insight_box(
                    f"Best strategy: {best_strat} (F1 = {strat_results[best_strat]:.4f}). "
                    "SMOTE often outperforms raw training on minority classes. "
                    "Undersampling is faster but loses majority-class patterns.",
                    "success",
                ), unsafe_allow_html=True)
