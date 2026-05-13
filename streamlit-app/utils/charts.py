"""Shared chart helpers — Cyber-Intelligence dark theme for Matplotlib + Plotly."""
import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

from utils.styles import COLORS, ATTACK_COLORS, get_attack_color

# ── Matplotlib dark theme ─────────────────────────────────────────────────────
MPL_RC = {
    "figure.facecolor":       "#020409",
    "axes.facecolor":         "#080d1a",
    "axes.edgecolor":         "rgba(0,245,255,0.12)",
    "axes.labelcolor":        "#cce8ff",
    "axes.titlecolor":        "#00f5ff",
    "axes.titlesize":         13,
    "axes.titlefontsize":     13,
    "axes.titleweight":       "bold",
    "text.color":             "#cce8ff",
    "xtick.color":            "#3a5070",
    "ytick.color":            "#3a5070",
    "xtick.labelsize":        9,
    "ytick.labelsize":        9,
    "grid.color":             "#0d1526",
    "grid.alpha":             1.0,
    "legend.facecolor":       "#080d1a",
    "legend.edgecolor":       "rgba(0,245,255,0.15)",
    "legend.labelcolor":      "#cce8ff",
    "savefig.facecolor":      "#020409",
    "figure.figsize":         (10, 5),
    "font.family":            "monospace",
    "axes.spines.top":        False,
    "axes.spines.right":      False,
    "axes.spines.left":       True,
    "axes.spines.bottom":     True,
}

PLOTLY_TEMPLATE = "plotly_dark"

PLOTLY_BASE = dict(
    template=PLOTLY_TEMPLATE,
    paper_bgcolor="#020409",
    plot_bgcolor="#080d1a",
    font=dict(family="JetBrains Mono, Oxanium, monospace", color="#cce8ff", size=11),
    margin=dict(l=40, r=20, t=40, b=40),
    legend=dict(
        bgcolor="#0b1220",
        bordercolor="rgba(0,245,255,0.2)",
        borderwidth=1,
        font=dict(color="#8aaccc"),
    ),
    xaxis=dict(gridcolor="#0d1526", zerolinecolor="rgba(0,245,255,0.1)",
               tickfont=dict(color="#3a5070")),
    yaxis=dict(gridcolor="#0d1526", zerolinecolor="rgba(0,245,255,0.1)",
               tickfont=dict(color="#3a5070")),
)


def apply_dark_theme():
    mpl.rcParams.update(MPL_RC)


def dark_fig(w: int = 10, h: int = 5):
    apply_dark_theme()
    fig, ax = plt.subplots(figsize=(w, h))
    fig.patch.set_facecolor("#020409")
    ax.set_facecolor("#080d1a")
    for spine in ax.spines.values():
        spine.set_edgecolor("rgba(0,245,255,0.08)")
    ax.tick_params(colors="#3a5070")
    return fig, ax


def plotly_dark_layout(fig: go.Figure, title: str = "", h: int = 400) -> go.Figure:
    layout = dict(**PLOTLY_BASE, height=h)
    if title:
        layout["title"] = dict(
            text=title,
            font=dict(size=13, color="#00f5ff", family="Oxanium"),
        )
    fig.update_layout(**layout)
    # Style axes
    fig.update_xaxes(
        gridcolor="#0d1526", zerolinecolor="rgba(0,245,255,0.08)",
        tickfont=dict(color="#3a5070"),
    )
    fig.update_yaxes(
        gridcolor="#0d1526", zerolinecolor="rgba(0,245,255,0.08)",
        tickfont=dict(color="#3a5070"),
    )
    return fig


def label_color_map(labels: list) -> dict:
    return {lbl: get_attack_color(lbl) for lbl in labels}


# ── Reusable chart functions ──────────────────────────────────────────────────

def bar_class_distribution(counts, title: str = "Class Distribution") -> go.Figure:
    labels = counts.index.tolist()
    vals   = counts.values.tolist()
    colors = [get_attack_color(l) for l in labels]
    fig = go.Figure(go.Bar(
        x=vals, y=labels, orientation="h",
        marker=dict(
            color=colors,
            line=dict(color="rgba(0,0,0,0.3)", width=0.5),
        ),
        text=[f"{v:,}" for v in vals],
        textposition="outside",
        textfont=dict(color="#8aaccc", size=10, family="JetBrains Mono"),
    ))
    plotly_dark_layout(fig, title, h=max(300, len(labels) * 42 + 60))
    fig.update_layout(yaxis=dict(autorange="reversed"))
    return fig


def pie_class_distribution(counts) -> go.Figure:
    labels = counts.index.tolist()
    vals   = counts.values.tolist()
    colors = [get_attack_color(l) for l in labels]
    fig = go.Figure(go.Pie(
        labels=labels, values=vals,
        marker=dict(colors=colors, line=dict(color="#020409", width=2)),
        textfont=dict(color="#cce8ff", size=10),
        hole=0.5,
        hovertemplate="<b>%{label}</b><br>%{value:,}<br>%{percent}<extra></extra>",
    ))
    plotly_dark_layout(fig, "Attack Distribution", h=400)
    return fig


def heatmap_corr(corr_matrix, title: str = "Correlation") -> go.Figure:
    fig = go.Figure(go.Heatmap(
        z=corr_matrix.values,
        x=corr_matrix.columns.tolist(),
        y=corr_matrix.index.tolist(),
        colorscale=[[0, "#ff2244"], [0.5, "#080d1a"], [1, "#00f5ff"]],
        zmid=0,
        colorbar=dict(tickfont=dict(color="#8aaccc"), outlinecolor="rgba(0,245,255,0.1)"),
        hoverongaps=False,
    ))
    plotly_dark_layout(fig, title, h=max(400, len(corr_matrix) * 20 + 100))
    fig.update_layout(
        xaxis=dict(tickfont=dict(size=8), tickangle=-45),
        yaxis=dict(tickfont=dict(size=8)),
    )
    return fig


def scatter_bivariate(df, x: str, y: str, label_col: str, sample: int = 5000) -> go.Figure:
    import pandas as pd
    s = df.sample(min(sample, len(df)), random_state=42)
    fig = px.scatter(
        s, x=x, y=y, color=label_col,
        color_discrete_map=label_color_map(df[label_col].unique().tolist()),
        opacity=0.55, template=PLOTLY_TEMPLATE,
    )
    plotly_dark_layout(fig, f"{x} vs {y}", h=460)
    fig.update_traces(marker=dict(size=4))
    return fig


def roc_curve_plot(fpr_dict: dict, tpr_dict: dict, auc_dict: dict) -> go.Figure:
    fig = go.Figure()
    palette = list(ATTACK_COLORS.values())
    for i, cls in enumerate(fpr_dict):
        color = palette[i % len(palette)]
        fig.add_trace(go.Scatter(
            x=fpr_dict[cls], y=tpr_dict[cls],
            name=f"{cls} ({auc_dict[cls]:.3f})",
            line=dict(color=color, width=2), mode="lines",
        ))
    fig.add_trace(go.Scatter(
        x=[0,1], y=[0,1],
        line=dict(color="#3a5070", dash="dot"), showlegend=False,
    ))
    plotly_dark_layout(fig, "ROC Curves (One-vs-Rest)", h=460)
    fig.update_layout(xaxis_title="False Positive Rate", yaxis_title="True Positive Rate")
    return fig


def confusion_matrix_plot(cm, labels: list) -> go.Figure:
    fig = go.Figure(go.Heatmap(
        z=cm, x=labels, y=labels,
        colorscale=[[0, "#020409"], [0.5, "#0b1f3a"], [1, "#00f5ff"]],
        text=cm, texttemplate="%{text}",
        textfont=dict(size=9, color="#cce8ff"),
        colorbar=dict(tickfont=dict(color="#8aaccc")),
    ))
    plotly_dark_layout(fig, "Confusion Matrix", h=max(360, len(labels) * 42 + 80))
    fig.update_layout(
        xaxis_title="Predicted", yaxis_title="Actual",
        xaxis=dict(tickangle=-30, tickfont=dict(size=9)),
        yaxis=dict(tickfont=dict(size=9)),
    )
    return fig


def radar_chart(categories: list, traces: dict) -> go.Figure:
    fig = go.Figure()
    palette = list(ATTACK_COLORS.values())
    for i, (name, vals) in enumerate(traces.items()):
        color = get_attack_color(name)
        rgba = _hex_to_rgba(color, 0.15)
        fig.add_trace(go.Scatterpolar(
            r=vals + [vals[0]],
            theta=categories + [categories[0]],
            fill="toself", name=name,
            line=dict(color=color, width=2),
            fillcolor=rgba,
        ))
    plotly_dark_layout(fig, "Attack Behavioral Fingerprint", h=460)
    fig.update_layout(polar=dict(
        bgcolor="#080d1a",
        radialaxis=dict(visible=True, gridcolor="#0d1526",
                        tickfont=dict(color="#3a5070")),
        angularaxis=dict(gridcolor="#0d1526",
                         tickfont=dict(color="#8aaccc")),
    ))
    return fig


def violin_plot(df, feature: str, label_col: str) -> go.Figure:
    labels = df[label_col].unique().tolist()
    fig = go.Figure()
    for lbl in labels:
        sub = df[df[label_col] == lbl][feature]
        color = get_attack_color(lbl)
        fig.add_trace(go.Violin(
            y=sub, name=lbl,
            box_visible=True, meanline_visible=True,
            fillcolor=_hex_to_rgba(color, 0.25),
            line_color=color, opacity=0.85,
        ))
    plotly_dark_layout(fig, f"{feature} — by Class", h=440)
    return fig


def _hex_to_rgba(hex_color: str, alpha: float) -> str:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"rgba({r},{g},{b},{alpha})"
    return f"rgba(0,245,255,{alpha})"
