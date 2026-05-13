"""Page 3 — Feature Intelligence."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import streamlit as st
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.feature_selection import mutual_info_classif
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings("ignore")

from utils.styles import (
    COLORS, inject_css, page_header, section_header,
    insight_box, summary_card, get_attack_color,
)
from utils.data_loader import LABEL_COL, SOURCE_COL
from utils.charts import apply_dark_theme, plotly_dark_layout
from utils.stats import point_biserial


def render(df: pd.DataFrame):
    apply_dark_theme()
    inject_css()

    st.markdown(page_header("🧠 Feature Intelligence",
        "Which features matter? Variance, correlation, MI, PCA, t-SNE"), unsafe_allow_html=True)

    if LABEL_COL not in df.columns:
        st.error(f"Label column '{LABEL_COL}' not found.")
        return

    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                if not c.startswith("_")]
    le = LabelEncoder()
    y = le.fit_transform(df[LABEL_COL].astype(str))
    binary_label = (df[LABEL_COL] != "BENIGN").astype(int)

    var_series = df[num_cols].var().sort_values(ascending=False)
    near_zero = (var_series < 1e-6).sum()

    st.markdown(summary_card([
        f"{near_zero} near-zero variance features — candidates for removal before modeling.",
        f"Top feature by variance: {var_series.index[0]} (σ² = {var_series.iloc[0]:.2f}).",
        "PCA, MI, and t-SNE computed below — each gives a different lens on separability.",
    ]), unsafe_allow_html=True)

    # ── Variance ranking ────────────────────────────────────────────────────
    st.markdown(section_header("Feature Variance Ranking"), unsafe_allow_html=True)
    top_var = var_series.head(40)
    colors_var = [COLORS["danger"] if v < 1e-6 else COLORS["warning"] if v < 0.1 else COLORS["accent"]
                  for v in top_var.values]
    apply_dark_theme()
    fig_v, ax_v = plt.subplots(figsize=(12, 6))
    ax_v.barh(top_var.index[::-1], top_var.values[::-1], color=colors_var[::-1])
    ax_v.set_title("Feature Variance (Top 40)", color="#cce8ff")
    fig_v.patch.set_facecolor("#020409")
    plt.tight_layout()
    st.pyplot(fig_v)
    plt.close(fig_v)
    st.markdown(insight_box(
        f"{near_zero} features have near-zero variance (shown in red) — they add no discriminative power. "
        "Removing them reduces model complexity and training time.",
        "warn" if near_zero > 0 else "success",
    ), unsafe_allow_html=True)

    # ── Point-biserial correlation with label ───────────────────────────────
    st.markdown(section_header("Feature Correlation with Label (Point-Biserial)",
        "Higher |r| = more predictive feature"), unsafe_allow_html=True)

    with st.spinner("Computing point-biserial correlations…"):
        pb_rows = []
        for col in num_cols[:60]:
            res = point_biserial(df[col], binary_label)
            pb_rows.append({"Feature": col, "r": res.get("r"), "p-value": res.get("p")})
        pb_df = pd.DataFrame(pb_rows).dropna(subset=["r"]).sort_values("r", key=abs, ascending=False)

    fig_pb = go.Figure(go.Bar(
        x=pb_df["r"].head(30),
        y=pb_df["Feature"].head(30),
        orientation="h",
        marker_color=[COLORS["success"] if r > 0 else COLORS["danger"] for r in pb_df["r"].head(30)],
    ))
    plotly_dark_layout(fig_pb, "Point-Biserial r: Feature vs Attack/Benign Label", h=500)
    fig_pb.update_layout(yaxis=dict(autorange="reversed"))
    st.plotly_chart(fig_pb, use_container_width=True)
    st.dataframe(pb_df.head(20), use_container_width=True, height=250)
    st.markdown(insight_box(
        f"Top feature by correlation: {pb_df['Feature'].iloc[0]} (r = {pb_df['r'].iloc[0]:.4f}). "
        "Positive r = higher values in attack flows. Negative r = higher in BENIGN flows. "
        "These are your most linearly predictive features.",
        "info",
    ), unsafe_allow_html=True)

    # ── Mutual information ──────────────────────────────────────────────────
    st.markdown(section_header("Mutual Information Scores",
        "Non-linear importance. Compare ranking with correlation."), unsafe_allow_html=True)

    sample_df = df.sample(min(10000, len(df)), random_state=42)
    X_mi = sample_df[num_cols[:60]].fillna(0).values

    with st.spinner("Computing mutual information…"):
        try:
            mi_scores = mutual_info_classif(X_mi, le.transform(sample_df[LABEL_COL].astype(str)),
                                            discrete_features=False, random_state=42)
            mi_df = pd.DataFrame({"Feature": num_cols[:60], "MI Score": mi_scores})
            mi_df = mi_df.sort_values("MI Score", ascending=False)
        except Exception as e:
            st.markdown(insight_box(f"MI computation failed: {e}", "warn"), unsafe_allow_html=True)
            mi_df = pd.DataFrame()

    if not mi_df.empty:
        fig_mi = go.Figure(go.Bar(
            x=mi_df["MI Score"].head(30),
            y=mi_df["Feature"].head(30),
            orientation="h",
            marker_color=COLORS["warning"],
        ))
        plotly_dark_layout(fig_mi, "Mutual Information Score (Top 30)", h=500)
        fig_mi.update_layout(yaxis=dict(autorange="reversed"))
        st.plotly_chart(fig_mi, use_container_width=True)

        # Compare MI vs correlation ranking
        if not pb_df.empty:
            mi_top = mi_df["Feature"].head(15).tolist()
            pb_top = pb_df["Feature"].head(15).tolist()
            in_mi_not_pb = set(mi_top) - set(pb_top)
            in_pb_not_mi = set(pb_top) - set(mi_top)
            if in_mi_not_pb or in_pb_not_mi:
                st.markdown(insight_box(
                    f"MI and correlation rankings diverge: {len(in_mi_not_pb)} features in MI top-15 "
                    f"not in correlation top-15 (e.g. {list(in_mi_not_pb)[:2]}). "
                    "These may have non-linear relationships with the label — important for tree models.",
                    "warn",
                ), unsafe_allow_html=True)

    # ── PCA ──────────────────────────────────────────────────────────────────
    st.markdown(section_header("PCA Analysis",
        "Dimensionality reduction — how many components explain the variance?"), unsafe_allow_html=True)

    pca_sample = df[num_cols].sample(min(10000, len(df)), random_state=42).fillna(0)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(pca_sample.values)

    with st.spinner("Running PCA…"):
        n_comp = min(50, len(num_cols), len(pca_sample))
        pca = PCA(n_components=n_comp, random_state=42)
        pca.fit(X_scaled)

    ev = pca.explained_variance_ratio_
    cumev = np.cumsum(ev)

    pcol1, pcol2 = st.columns(2)
    with pcol1:
        fig_scree = go.Figure()
        fig_scree.add_trace(go.Bar(x=list(range(1, len(ev) + 1)), y=ev,
                                   name="Per-Component", marker_color=COLORS["accent"]))
        fig_scree.add_trace(go.Scatter(x=list(range(1, len(ev) + 1)), y=cumev,
                                       name="Cumulative", line=dict(color=COLORS["success"], width=2)))
        plotly_dark_layout(fig_scree, "PCA Scree Plot", h=350)
        st.plotly_chart(fig_scree, use_container_width=True)
    with pcol2:
        n80 = int(np.searchsorted(cumev, 0.80)) + 1
        n90 = int(np.searchsorted(cumev, 0.90)) + 1
        n95 = int(np.searchsorted(cumev, 0.95)) + 1
        for threshold, n in [("80%", n80), ("90%", n90), ("95%", n95)]:
            st.markdown(
                f'<div style="background:{"#080d1a"};border:1px solid {"rgba(0,245,255,0.1)"};'
                f'border-radius:8px;padding:14px;margin:6px 0;">'
                f'<span style="color:{"#3a5070"};font-size:0.8rem;">{threshold} variance:</span> '
                f'<span style="color:{COLORS["accent"]};font-weight:700;font-size:1.4rem;">{n}</span>'
                f' <span style="color:{"#3a5070"};font-size:0.8rem;">components</span></div>',
                unsafe_allow_html=True,
            )

    # PC1 vs PC2 scatter
    pca_2 = PCA(n_components=2, random_state=42)
    X_2d = pca_2.fit_transform(X_scaled)
    pca_plot_df = pd.DataFrame({"PC1": X_2d[:, 0], "PC2": X_2d[:, 1]})
    pca_plot_df[LABEL_COL] = df[LABEL_COL].sample(min(10000, len(df)), random_state=42).values
    import plotly.express as px
    fig_pc = px.scatter(
        pca_plot_df.sample(min(3000, len(pca_plot_df)), random_state=42),
        x="PC1", y="PC2", color=LABEL_COL,
        color_discrete_map={l: get_attack_color(l) for l in pca_plot_df[LABEL_COL].unique()},
        template="plotly_dark", opacity=0.6,
    )
    plotly_dark_layout(fig_pc, "PCA: PC1 vs PC2 colored by Attack Class", h=420)
    st.plotly_chart(fig_pc, use_container_width=True)
    st.caption("Computed on 10,000-row sample.")
    st.markdown(insight_box(
        f"PC1+PC2 explain {cumev[1]*100:.1f}% of variance. "
        "If attack clusters are visible, linear separability is high. "
        f"To capture 95% of variance, {n95} components are needed vs {len(num_cols)} original features "
        f"— a {round((1-n95/len(num_cols))*100,0):.0f}% dimensionality reduction.",
        "info",
    ), unsafe_allow_html=True)

    # ── Feature redundancy dendrogram ────────────────────────────────────────
    st.markdown(section_header("Feature Redundancy Map (Hierarchical Clustering)",
        "Features with similar patterns cluster together"), unsafe_allow_html=True)

    top30_cols = df[num_cols].var().nlargest(30).index.tolist()
    corr30 = df[top30_cols].corr()
    from scipy.cluster.hierarchy import linkage, dendrogram
    apply_dark_theme()
    fig_dend, ax_dend = plt.subplots(figsize=(14, 5))
    fig_dend.patch.set_facecolor("#020409")
    ax_dend.set_facecolor("#080d1a")
    dist_matrix = 1 - corr30.abs()
    np.fill_diagonal(dist_matrix.values, 0)
    from scipy.spatial.distance import squareform
    try:
        condensed = squareform(dist_matrix.values, checks=False)
        Z = linkage(condensed, method="ward")
        dendrogram(Z, labels=top30_cols, ax=ax_dend, leaf_rotation=90, leaf_font_size=8,
                   color_threshold=0.3 * max(Z[:, 2]),
                   above_threshold_color="#3a5070")
        ax_dend.set_title("Feature Dendrogram (Top 30 by Variance)", color="#cce8ff")
        ax_dend.tick_params(colors="#3a5070")
        plt.tight_layout()
        st.pyplot(fig_dend)
        plt.close(fig_dend)
    except Exception as e:
        st.markdown(insight_box(f"Dendrogram failed: {e}", "warn"), unsafe_allow_html=True)

    st.markdown(insight_box(
        "Features that branch at low height (left side) are nearly identical. "
        "Clusters of 3+ features at height < 0.1 are redundant — keep only the most interpretable one.",
        "info",
    ), unsafe_allow_html=True)

    # ── t-SNE ────────────────────────────────────────────────────────────────
    st.markdown(section_header("t-SNE Visualization (2D)",
        "High-dimensional separability check — 2,000-row sample"), unsafe_allow_html=True)
    st.markdown(insight_box(
        "t-SNE is a non-linear embedding that preserves local structure. "
        "If attack classes form distinct clusters, the features are sufficient to separate them. "
        "⚠ t-SNE takes 30–60 seconds on 2,000 rows.",
        "warn",
    ), unsafe_allow_html=True)

    if st.button("▶ Run t-SNE (2,000 rows)", key="tsne_btn"):
        tsne_sample = df.sample(min(2000, len(df)), random_state=42)
        X_tsne = StandardScaler().fit_transform(tsne_sample[num_cols].fillna(0).values)
        from sklearn.manifold import TSNE
        with st.spinner("Running t-SNE… (~30–60s)"):
            try:
                tsne = TSNE(n_components=2, perplexity=30, n_iter=500, random_state=42)
                emb = tsne.fit_transform(X_tsne)
                tsne_df = pd.DataFrame({"x": emb[:, 0], "y": emb[:, 1]})
                tsne_df[LABEL_COL] = tsne_sample[LABEL_COL].values
                fig_tsne = px.scatter(
                    tsne_df, x="x", y="y", color=LABEL_COL,
                    color_discrete_map={l: get_attack_color(l) for l in tsne_df[LABEL_COL].unique()},
                    template="plotly_dark", opacity=0.7,
                )
                plotly_dark_layout(fig_tsne, "t-SNE (2,000-row sample)", h=500)
                st.plotly_chart(fig_tsne, use_container_width=True)
                st.caption("Computed on 2,000-row sample for performance.")
            except Exception as e:
                st.markdown(insight_box(f"t-SNE failed: {e}", "danger"), unsafe_allow_html=True)

    # ── Top feature per attack class ──────────────────────────────────────────
    st.markdown(section_header("Top Feature per Attack Class",
        "Which feature most distinguishes each attack from BENIGN?"), unsafe_allow_html=True)

    benign_means = df[df[LABEL_COL] == "BENIGN"][num_cols].mean()
    benign_stds = df[df[LABEL_COL] == "BENIGN"][num_cols].std().replace(0, 1)

    attack_classes = [l for l in df[LABEL_COL].unique() if l != "BENIGN"]
    top_feat_rows = []
    for cls in attack_classes:
        sub = df[df[LABEL_COL] == cls]
        if len(sub) < 5:
            continue
        cls_means = sub[num_cols].mean()
        z_scores = (cls_means - benign_means) / benign_stds
        top_feat = z_scores.abs().nlargest(1)
        top_feat_rows.append({
            "Attack Class": cls,
            "Top Feature": top_feat.index[0],
            "Z-Score vs BENIGN": round(float(top_feat.iloc[0]), 2),
            "Attack Mean": round(float(cls_means[top_feat.index[0]]), 4),
            "BENIGN Mean": round(float(benign_means[top_feat.index[0]]), 4),
        })
    top_feat_df = pd.DataFrame(top_feat_rows).sort_values("Z-Score vs BENIGN", ascending=False)
    st.dataframe(top_feat_df, use_container_width=True)

    # Heatmap of z-scores
    if attack_classes:
        top_features_set = top_feat_df["Top Feature"].unique().tolist()[:15]
        z_matrix = pd.DataFrame(index=attack_classes, columns=top_features_set, dtype=float)
        for cls in attack_classes:
            sub = df[df[LABEL_COL] == cls]
            if len(sub) < 5:
                continue
            cls_means = sub[top_features_set].mean()
            z_matrix.loc[cls] = ((cls_means - benign_means[top_features_set])
                                  / benign_stds[top_features_set]).values
        z_matrix = z_matrix.dropna(how="all").astype(float)
        if not z_matrix.empty:
            fig_zh = go.Figure(go.Heatmap(
                z=z_matrix.values.tolist(),
                x=z_matrix.columns.tolist(),
                y=z_matrix.index.tolist(),
                colorscale="RdBu",
                zmid=0,
                colorbar=dict(tickfont=dict(color="#cce8ff"), title="Z-score"),
            ))
            plotly_dark_layout(fig_zh, "Z-Score Heatmap: Attack Class × Feature", h=350)
            fig_zh.update_layout(xaxis=dict(tickangle=-35, tickfont=dict(size=9)))
            st.plotly_chart(fig_zh, use_container_width=True)
    st.markdown(insight_box(
        "Large positive z-scores (red) = feature is much higher in that attack vs BENIGN. "
        "This is the signature fingerprint for each attack type — "
        "use these features in rule-based detection as a baseline.",
        "info",
    ), unsafe_allow_html=True)
