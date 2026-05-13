"""Page 7 — SHAP Explainability."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import streamlit as st
import warnings
warnings.filterwarnings("ignore")

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card, get_attack_color,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import apply_dark_theme, plotly_dark_layout
from utils.ml import prepare_features, day_split, build_xgboost


def _ensure_model(df: pd.DataFrame) -> tuple:
    """Train or retrieve XGBoost from session state."""
    if "shap_model" in st.session_state:
        return (st.session_state["shap_model"],
                st.session_state["shap_scaler"],
                st.session_state["shap_le"],
                st.session_state["shap_feat_cols"],
                st.session_state["shap_X_test"],
                st.session_state["shap_y_test"])

    from sklearn.preprocessing import StandardScaler
    train_df, test_df = day_split(df)
    X_train, y_train, le, feat_cols = prepare_features(train_df)
    X_test, y_test, _, _ = prepare_features(test_df)
    y_test = le.transform(test_df[LABEL_COL].astype(str))

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = build_xgboost(len(le.classes_))
    model.fit(X_train_s, y_train)

    st.session_state.update({
        "shap_model": model,
        "shap_scaler": scaler,
        "shap_le": le,
        "shap_feat_cols": feat_cols,
        "shap_X_test": X_test_s,
        "shap_y_test": y_test,
    })
    return model, scaler, le, feat_cols, X_test_s, y_test


def render(df: pd.DataFrame):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("💡 SHAP Explainability",
        "Turn ML predictions into analyst-readable explanations"), unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    st.markdown(summary_card([
        "SHAP values show which features push each prediction toward or away from a class.",
        "Global SHAP summary reveals model-wide feature importance (more trustworthy than gain).",
        "Single-sample waterfall explains individual predictions in plain language.",
    ]), unsafe_allow_html=True)

    # ── Train / load model ─────────────────────────────────────────────────────
    st.markdown(section_header("Model Setup"), unsafe_allow_html=True)
    sample_for_shap = st.slider("Training sample size for SHAP model",
                                min_value=5000, max_value=min(80000, len(df)),
                                value=min(30000, len(df)), step=5000, key="shap_sample")

    if st.button("▶ Train XGBoost + Compute SHAP", key="shap_train_btn"):
        work_df = df.sample(sample_for_shap, random_state=42)
        # Clear cached model
        for k in ["shap_model", "shap_scaler", "shap_le", "shap_feat_cols",
                  "shap_X_test", "shap_y_test", "shap_values", "shap_feat_cols_stored"]:
            st.session_state.pop(k, None)

        with st.spinner("Training XGBoost…"):
            model, scaler, le, feat_cols, X_test_s, y_test = _ensure_model(work_df)

        shap_sample_X = X_test_s[:min(500, len(X_test_s))]
        with st.spinner("Computing SHAP values (500-row sample)…"):
            try:
                import shap
                explainer = shap.TreeExplainer(model)
                shap_vals = explainer.shap_values(shap_sample_X)
                st.session_state["shap_values"] = shap_vals
                st.session_state["shap_feat_cols_stored"] = feat_cols
                st.session_state["shap_explainer"] = explainer
                st.success("SHAP values computed!")
            except Exception as e:
                st.markdown(insight_box(f"SHAP computation failed: {e}", "danger"), unsafe_allow_html=True)
                return

    model_ready = "shap_model" in st.session_state
    shap_ready = "shap_values" in st.session_state

    if not model_ready:
        st.markdown(insight_box("Click 'Train XGBoost + Compute SHAP' to begin.", "info"),
            unsafe_allow_html=True)
        return

    model = st.session_state["shap_model"]
    le: "LabelEncoder" = st.session_state["shap_le"]
    feat_cols: list = st.session_state["shap_feat_cols"]
    X_test_s: np.ndarray = st.session_state["shap_X_test"]
    y_test: np.ndarray = st.session_state["shap_y_test"]

    if not shap_ready:
        st.markdown(insight_box("Model trained. Click button above to also compute SHAP.", "warn"),
            unsafe_allow_html=True)
        return

    shap_vals = st.session_state["shap_values"]
    shap_X = X_test_s[:min(500, len(X_test_s))]

    # ── Global SHAP summary ────────────────────────────────────────────────────
    st.markdown(section_header("Global SHAP Summary",
        "Top 20 features by mean |SHAP| across all classes"), unsafe_allow_html=True)

    try:
        import shap
        # shap_vals is list of arrays [class_0, class_1, ...] or single array
        if isinstance(shap_vals, list):
            mean_abs_shap = np.mean([np.abs(sv) for sv in shap_vals], axis=0)
        else:
            mean_abs_shap = np.abs(shap_vals)

        global_imp = pd.Series(mean_abs_shap.mean(axis=0), index=feat_cols).sort_values(ascending=False)
        top20_imp = global_imp.head(20)

        fig_gshap = go.Figure(go.Bar(
            x=top20_imp.values,
            y=top20_imp.index,
            orientation="h",
            marker_color=COLORS["accent"],
            text=[f"{v:.4f}" for v in top20_imp.values],
            textposition="outside",
        ))
        plotly_dark_layout(fig_gshap, "Mean |SHAP| — Global Feature Importance (Top 20)", h=500)
        fig_gshap.update_layout(yaxis=dict(autorange="reversed"))
        st.plotly_chart(fig_gshap, use_container_width=True)
        st.caption("Computed on 500-row test sample.")
        st.markdown(insight_box(
            f"Top global feature: {top20_imp.index[0]} "
            f"(mean |SHAP| = {top20_imp.iloc[0]:.4f}). "
            "SHAP importance is model-agnostic and captures non-linear effects, "
            "unlike simple gain importance.",
            "info",
        ), unsafe_allow_html=True)

        # ── SHAP vs gain importance ─────────────────────────────────────────────
        st.markdown(section_header("SHAP vs XGBoost Gain Importance",
            "Where they diverge: possible spurious correlations"), unsafe_allow_html=True)

        try:
            gain_imp = pd.Series(model.get_booster().get_score(importance_type="gain"))
            gain_imp.index = [f.replace("f", "") for f in gain_imp.index]
            # Map feature indices to names
            feat_idx_map = {str(i): col for i, col in enumerate(feat_cols)}
            gain_imp.index = [feat_idx_map.get(i, i) for i in gain_imp.index]
            gain_imp = gain_imp.sort_values(ascending=False).head(20)

            shap_top20 = set(top20_imp.index[:20])
            gain_top20 = set(gain_imp.index[:20])
            diverged = shap_top20.symmetric_difference(gain_top20)

            cmp1, cmp2 = st.columns(2)
            with cmp1:
                st.markdown("**SHAP Top 20**")
                for i, (feat, val) in enumerate(top20_imp.items()):
                    marker = "⚠" if feat in diverged else ""
                    st.markdown(
                        f'<div style="font-size:0.82rem;padding:3px 0;">'
                        f'{i+1}. {feat} {marker}</div>',
                        unsafe_allow_html=True,
                    )
            with cmp2:
                st.markdown("**Gain Top 20**")
                for i, (feat, val) in enumerate(gain_imp.items()):
                    marker = "⚠" if feat in diverged else ""
                    st.markdown(
                        f'<div style="font-size:0.82rem;padding:3px 0;">'
                        f'{i+1}. {feat} {marker}</div>',
                        unsafe_allow_html=True,
                    )
            if diverged:
                st.markdown(insight_box(
                    f"{len(diverged)} features differ between SHAP and gain rankings (marked ⚠). "
                    "Features high in gain but low in SHAP may be spurious — high gain from a single "
                    "split that doesn't generalize. Trust SHAP for production feature selection.",
                    "warn",
                ), unsafe_allow_html=True)
        except Exception as e:
            st.markdown(insight_box(f"Gain importance comparison failed: {e}", "warn"), unsafe_allow_html=True)

        # ── Per-class SHAP ─────────────────────────────────────────────────────
        st.markdown(section_header("Per-Class SHAP Importance",
            "Different attacks are driven by different features"), unsafe_allow_html=True)

        if isinstance(shap_vals, list) and len(shap_vals) > 1:
            class_names = list(le.classes_)
            sel_cls_shap = st.selectbox("Select class", class_names, key="shap_cls")
            cls_idx = list(class_names).index(sel_cls_shap)
            cls_shap = shap_vals[cls_idx]
            cls_imp = pd.Series(np.abs(cls_shap).mean(axis=0), index=feat_cols).sort_values(ascending=False).head(10)

            fig_cls_shap = go.Figure(go.Bar(
                x=cls_imp.values,
                y=cls_imp.index,
                orientation="h",
                marker_color=get_attack_color(sel_cls_shap),
            ))
            plotly_dark_layout(fig_cls_shap, f"Top 10 SHAP Features for {sel_cls_shap}", h=380)
            fig_cls_shap.update_layout(yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig_cls_shap, use_container_width=True)
            st.markdown(insight_box(
                f"For '{sel_cls_shap}', the top feature is {cls_imp.index[0]} "
                f"(mean |SHAP| = {cls_imp.iloc[0]:.4f}). "
                "Per-class SHAP reveals that different attacks are identified by different features — "
                "a one-size-fits-all feature set is suboptimal.",
                "info",
            ), unsafe_allow_html=True)

        # ── SHAP interaction ────────────────────────────────────────────────────
        st.markdown(section_header("SHAP Interaction (Top 2 Features)",
            "How feature A's SHAP changes based on feature B's value"), unsafe_allow_html=True)

        if isinstance(shap_vals, list):
            mean_shap_arr = np.mean([np.abs(sv) for sv in shap_vals], axis=0)
        else:
            mean_shap_arr = np.abs(shap_vals)
        top2_feats = pd.Series(mean_shap_arr.mean(axis=0), index=feat_cols).nlargest(2).index.tolist()

        if len(top2_feats) >= 2:
            feat_a_idx = feat_cols.index(top2_feats[0])
            feat_b_idx = feat_cols.index(top2_feats[1])

            if isinstance(shap_vals, list):
                shap_a = np.mean([sv[:, feat_a_idx] for sv in shap_vals], axis=0)
            else:
                shap_a = shap_vals[:, feat_a_idx]

            feat_b_vals = shap_X[:len(shap_a), feat_b_idx]
            fig_inter = go.Figure(go.Scatter(
                x=shap_X[:len(shap_a), feat_a_idx],
                y=shap_a,
                mode="markers",
                marker=dict(
                    color=feat_b_vals,
                    colorscale="RdBu",
                    size=5,
                    colorbar=dict(title=top2_feats[1], tickfont=dict(color="#cce8ff")),
                ),
                text=[f"{top2_feats[1]}={v:.2f}" for v in feat_b_vals],
                hovertemplate="Feature A: %{x:.2f}<br>SHAP: %{y:.4f}<br>%{text}<extra></extra>",
            ))
            plotly_dark_layout(fig_inter,
                f"SHAP Interaction: {top2_feats[0]} (colored by {top2_feats[1]})", h=400)
            fig_inter.update_layout(
                xaxis_title=top2_feats[0],
                yaxis_title=f"SHAP value for {top2_feats[0]}",
            )
            st.plotly_chart(fig_inter, use_container_width=True)

        # ── Single prediction explainer ──────────────────────────────────────────
        st.markdown(section_header("Single Prediction Explainer",
            "Select a test sample and see why the model classified it as it did"),
            unsafe_allow_html=True)

        max_idx = min(499, len(shap_X) - 1)
        sample_idx = st.number_input("Test sample index", min_value=0, max_value=max_idx,
                                     value=0, step=1, key="shap_sample_idx")

        x_row = shap_X[sample_idx:sample_idx + 1]
        y_true = y_test[sample_idx] if sample_idx < len(y_test) else 0
        y_pred = model.predict(x_row)[0]
        y_prob_row = model.predict_proba(x_row)[0]

        pred_label = le.classes_[y_pred] if y_pred < len(le.classes_) else str(y_pred)
        true_label = le.classes_[y_true] if y_true < len(le.classes_) else str(y_true)
        correct = y_pred == y_true

        excol1, excol2, excol3 = st.columns(3)
        excol1.markdown(
            f'<div style="background:{"#080d1a"};border:1px solid {"rgba(0,245,255,0.1)"};'
            f'border-radius:8px;padding:14px;text-align:center;">'
            f'<div style="color:{"#3a5070"};font-size:0.75rem;">PREDICTED</div>'
            f'<div style="color:{get_attack_color(pred_label)};font-size:1.1rem;font-weight:700;">'
            f'{pred_label}</div></div>',
            unsafe_allow_html=True,
        )
        excol2.markdown(
            f'<div style="background:{"#080d1a"};border:1px solid {"rgba(0,245,255,0.1)"};'
            f'border-radius:8px;padding:14px;text-align:center;">'
            f'<div style="color:{"#3a5070"};font-size:0.75rem;">ACTUAL</div>'
            f'<div style="color:{get_attack_color(true_label)};font-size:1.1rem;font-weight:700;">'
            f'{true_label}</div></div>',
            unsafe_allow_html=True,
        )
        excol3.markdown(
            f'<div style="background:{"#080d1a"};border:1px solid {"rgba(0,245,255,0.1)"};'
            f'border-radius:8px;padding:14px;text-align:center;">'
            f'<div style="color:{"#3a5070"};font-size:0.75rem;">CORRECT?</div>'
            f'<div style="color:{COLORS["success"] if correct else COLORS["danger"]};'
            f'font-size:1.1rem;font-weight:700;">{"✓ Yes" if correct else "✗ No"}</div></div>',
            unsafe_allow_html=True,
        )

        # Confidence scores
        st.write("**Confidence per class:**")
        conf_df = pd.DataFrame({
            "Class": le.classes_,
            "Confidence": [round(float(p), 4) for p in y_prob_row],
        }).sort_values("Confidence", ascending=False)
        st.dataframe(conf_df, use_container_width=True, height=180)

        # Waterfall SHAP
        st.write("**SHAP Waterfall (feature contributions for this prediction):**")
        if isinstance(shap_vals, list):
            row_shap = shap_vals[y_pred][sample_idx]
        else:
            row_shap = shap_vals[sample_idx]

        top_contrib = pd.Series(row_shap, index=feat_cols).abs().nlargest(15).index.tolist()
        top_shap_vals = pd.Series(row_shap, index=feat_cols)[top_contrib]

        fig_wf = go.Figure(go.Waterfall(
            name="SHAP",
            orientation="h",
            measure=["relative"] * len(top_shap_vals),
            x=top_shap_vals.values.tolist(),
            y=top_shap_vals.index.tolist(),
            connector={"line": {"color": "rgba(0,245,255,0.1)"}},
            increasing={"marker": {"color": COLORS["danger"]}},
            decreasing={"marker": {"color": COLORS["accent"]}},
        ))
        plotly_dark_layout(fig_wf, "SHAP Waterfall — Sample Prediction", h=500)
        st.plotly_chart(fig_wf, use_container_width=True)

        # Human-readable explanation
        pushers = top_shap_vals[top_shap_vals > 0].nlargest(3)
        pullers = top_shap_vals[top_shap_vals < 0].nsmallest(3)
        explanation = (
            f"This flow was classified as **{pred_label}** because: "
        )
        if len(pushers) > 0:
            explanation += " | ".join([f"{f} = {shap_X[sample_idx, feat_cols.index(f)]:.2f} (+{v:.4f} toward {pred_label})"
                                       for f, v in pushers.items()])
        st.markdown(insight_box(explanation, "info"), unsafe_allow_html=True)

        # ── SHAP stability ──────────────────────────────────────────────────────
        st.markdown(section_header("SHAP Stability",
            "SHAP computed on 5 random 200-row subsamples — how consistent are the rankings?"),
            unsafe_allow_html=True)

        if st.button("▶ Run SHAP Stability Check", key="shap_stab_btn"):
            explainer = st.session_state.get("shap_explainer")
            if explainer is None:
                st.markdown(insight_box("Re-train the model first.", "warn"), unsafe_allow_html=True)
            else:
                all_imps = []
                with st.spinner("Computing SHAP on 5 subsamples…"):
                    for seed in range(5):
                        rng = np.random.RandomState(seed)
                        idxs = rng.choice(len(shap_X), size=min(200, len(shap_X)), replace=False)
                        sv = explainer.shap_values(shap_X[idxs])
                        if isinstance(sv, list):
                            imp = np.mean([np.abs(s) for s in sv], axis=0).mean(axis=0)
                        else:
                            imp = np.abs(sv).mean(axis=0)
                        all_imps.append(imp)

                all_imps = np.array(all_imps)
                stab_mean = all_imps.mean(axis=0)
                stab_std = all_imps.std(axis=0)
                stab_cv = stab_std / (stab_mean + 1e-9)

                stab_df = pd.DataFrame({
                    "Feature": feat_cols,
                    "Mean |SHAP|": stab_mean.round(5),
                    "Std |SHAP|": stab_std.round(5),
                    "CoV (instability)": stab_cv.round(4),
                }).sort_values("Mean |SHAP|", ascending=False).head(20)

                st.dataframe(stab_df, use_container_width=True, height=300)
                unstable_feats = (stab_df["CoV (instability)"] > 0.3).sum()
                st.markdown(insight_box(
                    f"{unstable_feats}/{len(stab_df)} features have high SHAP variance "
                    "(CoV > 0.3) — their explanations change across subsamples. "
                    "Avoid using these features for rule-based detection.",
                    "warn" if unstable_feats > 3 else "success",
                ), unsafe_allow_html=True)

    except Exception as e:
        st.markdown(insight_box(f"SHAP rendering error: {e}", "danger"), unsafe_allow_html=True)
