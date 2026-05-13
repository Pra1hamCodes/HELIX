import pandas as pd
import numpy as np
import streamlit as st
from pathlib import Path
from typing import Optional

LABEL_COL = "Label"
SOURCE_COL = "_source_file"

DATA_DIR = Path(__file__).parent.parent.parent / "MachineLearningCVE"


@st.cache_data(show_spinner="Loading CSV files…")
def load_raw_data(
    file_bytes: Optional[dict] = None,
    data_dir: str = "",
) -> tuple[Optional[pd.DataFrame], list[str]]:
    """
    Load one or more CICIDS2017 CSVs. Strip all column whitespace.
    file_bytes: {filename: bytes} dict from st.file_uploader.
    data_dir:   path to folder with *.csv files.
    Returns (raw_df, list_of_filenames).
    """
    dfs: list[pd.DataFrame] = []
    names: list[str] = []

    if file_bytes:
        import io
        for fname, data in file_bytes.items():
            df = pd.read_csv(
                io.BytesIO(data),
                low_memory=False,
                encoding="utf-8",
                on_bad_lines="skip",
            )
            df.columns = df.columns.str.strip()
            df[SOURCE_COL] = fname
            dfs.append(df)
            names.append(fname)
    else:
        base = Path(data_dir) if data_dir else DATA_DIR
        csvs = sorted(base.glob("*.csv"))
        for csv_path in csvs:
            try:
                df = pd.read_csv(
                    csv_path,
                    low_memory=False,
                    encoding="utf-8",
                    on_bad_lines="skip",
                )
                df.columns = df.columns.str.strip()
                df[SOURCE_COL] = csv_path.name
                dfs.append(df)
                names.append(csv_path.name)
            except Exception:
                continue

    if not dfs:
        return None, []

    combined = pd.concat(dfs, ignore_index=True)

    # Standardise label column
    if LABEL_COL in combined.columns:
        combined[LABEL_COL] = combined[LABEL_COL].astype(str).str.strip()

    return combined, names


@st.cache_data(show_spinner="Cleaning data…")
def clean_data(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, int, int, dict]:
    """
    Clean pipeline:
      1. Replace ±inf → NaN
      2. Drop NaN rows
      3. Drop exact duplicates
      4. Clip numeric features to [p1, p99]

    Returns (clean_df, original_row_count, clean_row_count, clip_info).
    clip_info: {col: {p1, p99, clipped_count}}
    """
    original = len(df)
    df = df.copy()

    # Step 1 – inf → NaN
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    df[num_cols] = df[num_cols].replace([np.inf, -np.inf], np.nan)

    # Step 2 – drop NaN
    df = df.dropna()

    # Step 3 – drop duplicates (exclude internal col)
    feature_cols = [c for c in df.columns if c != SOURCE_COL]
    df = df.drop_duplicates(subset=feature_cols)

    # Step 4 – clip outliers
    clip_info: dict = {}
    num_data_cols = [
        c
        for c in df.select_dtypes(include=[np.number]).columns
        if c != SOURCE_COL
    ]
    for col in num_data_cols:
        p1 = float(df[col].quantile(0.01))
        p99 = float(df[col].quantile(0.99))
        before_mask = (df[col] < p1) | (df[col] > p99)
        clipped = int(before_mask.sum())
        df[col] = df[col].clip(lower=p1, upper=p99)
        clip_info[col] = {"p1": p1, "p99": p99, "clipped": clipped}

    cleaned = len(df)
    df = df.reset_index(drop=True)
    return df, original, cleaned, clip_info


@st.cache_data(show_spinner=False)
def get_numeric_cols(df: pd.DataFrame) -> list[str]:
    return [
        c
        for c in df.select_dtypes(include=[np.number]).columns
        if not c.startswith("_")
    ]


@st.cache_data(show_spinner=False)
def get_feature_cols(df: pd.DataFrame) -> list[str]:
    exclude = {LABEL_COL, SOURCE_COL, "Timestamp"}
    return [
        c
        for c in df.columns
        if c not in exclude and not c.startswith("_")
        and df[c].dtype != object
    ]


@st.cache_data(show_spinner=False)
def quality_report(raw_df: pd.DataFrame) -> pd.DataFrame:
    """Per-column quality stats on the RAW (uncleaned) frame."""
    rows = []
    for col in raw_df.columns:
        if col.startswith("_"):
            continue
        s = raw_df[col]
        null_count = int(s.isna().sum())
        null_pct = round(null_count / len(raw_df) * 100, 2)
        inf_count = int(np.isinf(s.replace([None], np.nan)).sum()) if s.dtype != object else 0
        dup_count = int(s.duplicated().sum())
        unique = int(s.nunique())
        is_num = pd.api.types.is_numeric_dtype(s)
        row = {
            "Column": col,
            "Dtype": str(s.dtype),
            "Null Count": null_count,
            "Null %": null_pct,
            "Inf Count": inf_count,
            "Duplicates": dup_count,
            "Unique Values": unique,
            "Min": round(float(s.min()), 4) if is_num else "—",
            "Max": round(float(s.max()), 4) if is_num else "—",
            "Mean": round(float(s.mean()), 4) if is_num else "—",
        }
        rows.append(row)
    return pd.DataFrame(rows)


@st.cache_data(show_spinner=False)
def compute_health_score(quality_df: pd.DataFrame, clip_info: dict, label_issues: int) -> int:
    """
    0–100 data health score.
    Penalties: null rate, high-null cols, inf values, duplicates, label issues, clipped outliers.
    """
    score = 100

    avg_null_pct = quality_df["Null %"].mean()
    score -= min(30, avg_null_pct * 3)

    high_null_cols = (quality_df["Null %"] > 5).sum()
    score -= min(15, high_null_cols * 2)

    total_inf = quality_df["Inf Count"].sum()
    score -= min(15, total_inf / max(1, len(quality_df)) * 10)

    total_dups = quality_df["Duplicates"].sum()
    score -= min(10, total_dups / max(1, len(quality_df)) * 100)

    score -= min(10, label_issues * 5)

    total_clipped = sum(v["clipped"] for v in clip_info.values()) if clip_info else 0
    score -= min(10, total_clipped / max(1, sum(len(quality_df) for _ in [1])) * 0.01)

    return max(0, min(100, int(score)))
