"""Statistical test wrappers for CICIDS analyst."""
import numpy as np
import pandas as pd
from scipy import stats as sp_stats
from scipy.stats import (
    shapiro,
    kruskal,
    mannwhitneyu,
    ks_2samp,
    chi2_contingency,
    pearsonr,
    pointbiserialr,
)
import warnings

warnings.filterwarnings("ignore")


def normality_test(series: pd.Series, sample: int = 1000) -> dict:
    """Shapiro-Wilk normality test on a sample."""
    s = series.dropna()
    if len(s) < 3:
        return {"W": None, "p": None, "normal": None}
    s = s.sample(min(sample, len(s)), random_state=42)
    try:
        W, p = shapiro(s)
        return {"W": round(float(W), 4), "p": round(float(p), 6), "normal": bool(p > 0.05)}
    except Exception:
        return {"W": None, "p": None, "normal": None}


def kruskal_wallis_test(df: pd.DataFrame, feature: str, label_col: str) -> dict:
    """Kruskal-Wallis H-test: does feature differ across attack classes?"""
    groups = []
    for lbl, sub in df.groupby(label_col):
        vals = sub[feature].dropna().values
        if len(vals) > 1:
            groups.append(vals)
    if len(groups) < 2:
        return {"H": None, "p": None}
    try:
        H, p = kruskal(*groups)
        return {"H": round(float(H), 4), "p": round(float(p), 8)}
    except Exception:
        return {"H": None, "p": None}


def mann_whitney_test(
    series_a: pd.Series,
    series_b: pd.Series,
    label_a: str = "A",
    label_b: str = "B",
) -> dict:
    """Mann-Whitney U test between two groups. Returns U, p, effect size (r)."""
    a = series_a.dropna().values
    b = series_b.dropna().values
    if len(a) < 2 or len(b) < 2:
        return {"U": None, "p": None, "effect_r": None}
    try:
        U, p = mannwhitneyu(a, b, alternative="two-sided")
        n1, n2 = len(a), len(b)
        effect_r = round(float(U / (n1 * n2)), 4)
        # Cohen's d approximation
        pooled_std = np.sqrt((np.std(a) ** 2 + np.std(b) ** 2) / 2)
        cohens_d = round(float((np.mean(a) - np.mean(b)) / max(pooled_std, 1e-9)), 4)
        return {
            "U": round(float(U), 2),
            "p": round(float(p), 8),
            "effect_r": effect_r,
            "cohens_d": cohens_d,
        }
    except Exception:
        return {"U": None, "p": None, "effect_r": None, "cohens_d": None}


def ks_drift_test(series_a: pd.Series, series_b: pd.Series) -> dict:
    """Kolmogorov-Smirnov test for distribution drift between two samples."""
    a = series_a.dropna().values
    b = series_b.dropna().values
    if len(a) < 2 or len(b) < 2:
        return {"KS": None, "p": None, "drifted": None}
    try:
        ks, p = ks_2samp(a, b)
        return {
            "KS": round(float(ks), 4),
            "p": round(float(p), 8),
            "drifted": bool(p < 0.05),
        }
    except Exception:
        return {"KS": None, "p": None, "drifted": None}


def chi_squared_test(df: pd.DataFrame, cat_col: str, label_col: str) -> dict:
    """Chi-squared test of independence between a categorical column and label."""
    try:
        ct = pd.crosstab(df[cat_col], df[label_col])
        chi2, p, dof, _ = chi2_contingency(ct)
        return {
            "chi2": round(float(chi2), 4),
            "p": round(float(p), 8),
            "dof": int(dof),
            "contingency": ct,
        }
    except Exception:
        return {"chi2": None, "p": None, "dof": None, "contingency": None}


def point_biserial(series: pd.Series, binary_label: pd.Series) -> dict:
    """Point-biserial correlation between numeric feature and binary label."""
    s = series.dropna()
    idx = s.index.intersection(binary_label.index)
    s = s.loc[idx]
    b = binary_label.loc[idx]
    if len(s) < 2:
        return {"r": None, "p": None}
    try:
        r, p = pointbiserialr(b, s)
        return {"r": round(float(r), 4), "p": round(float(p), 8)}
    except Exception:
        return {"r": None, "p": None}


def run_normality_batch(
    df: pd.DataFrame, cols: list[str], sample: int = 1000
) -> pd.DataFrame:
    rows = []
    for col in cols:
        res = normality_test(df[col], sample)
        rows.append(
            {
                "Feature": col,
                "W Statistic": res["W"],
                "p-value": res["p"],
                "Normal?": "✓ Yes" if res["normal"] else "✗ No",
            }
        )
    return pd.DataFrame(rows)


def run_kruskal_batch(
    df: pd.DataFrame, cols: list[str], label_col: str
) -> pd.DataFrame:
    rows = []
    for col in cols:
        res = kruskal_wallis_test(df, col, label_col)
        rows.append(
            {
                "Feature": col,
                "H Statistic": res["H"],
                "p-value": res["p"],
                "Significant": "✓" if (res["p"] is not None and res["p"] < 0.05) else "✗",
            }
        )
    df_out = pd.DataFrame(rows).sort_values("H Statistic", ascending=False)
    return df_out


def run_mw_batch(
    df: pd.DataFrame, cols: list[str], label_col: str, benign_label: str = "BENIGN"
) -> pd.DataFrame:
    benign = df[df[label_col] == benign_label]
    attack = df[df[label_col] != benign_label]
    rows = []
    for col in cols:
        res = mann_whitney_test(benign[col], attack[col])
        rows.append(
            {
                "Feature": col,
                "U Statistic": res["U"],
                "p-value": res["p"],
                "Effect r": res.get("effect_r"),
                "Cohen's d": res.get("cohens_d"),
            }
        )
    df_out = pd.DataFrame(rows)
    if "Cohen's d" in df_out.columns:
        df_out = df_out.sort_values("Cohen's d", key=lambda x: x.abs(), ascending=False)
    return df_out


def run_ks_batch(
    df_a: pd.DataFrame, df_b: pd.DataFrame, cols: list[str]
) -> pd.DataFrame:
    rows = []
    for col in cols:
        if col not in df_a.columns or col not in df_b.columns:
            continue
        res = ks_drift_test(df_a[col], df_b[col])
        rows.append(
            {
                "Feature": col,
                "KS Statistic": res["KS"],
                "p-value": res["p"],
                "Drifted?": "⚠ YES" if res.get("drifted") else "✓ Stable",
            }
        )
    df_out = pd.DataFrame(rows).sort_values("KS Statistic", ascending=False)
    return df_out
