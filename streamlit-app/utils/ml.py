"""ML training, evaluation helpers for CICIDS analyst."""
import numpy as np
import pandas as pd
import warnings
from typing import Optional

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, learning_curve
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    roc_auc_score,
    roc_curve,
    precision_recall_curve,
    auc,
)
from sklearn.pipeline import Pipeline
import xgboost as xgb

warnings.filterwarnings("ignore")

LABEL_COL = "Label"
SOURCE_COL = "_source_file"


def prepare_features(
    df: pd.DataFrame, label_col: str = LABEL_COL
) -> tuple[np.ndarray, np.ndarray, LabelEncoder, list[str]]:
    """Encode labels, select numeric features, return X, y, encoder, feature_names."""
    exclude = {label_col, SOURCE_COL, "Timestamp", "_source_file"}
    feature_cols = [
        c
        for c in df.select_dtypes(include=[np.number]).columns
        if c not in exclude and not c.startswith("_")
    ]
    X = df[feature_cols].values
    le = LabelEncoder()
    y = le.fit_transform(df[label_col].astype(str))
    return X, y, le, feature_cols


def day_split(
    df: pd.DataFrame,
    source_col: str = SOURCE_COL,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split by day file: hold out the last day as test set.
    Falls back to random 80/20 if only one file.
    """
    files = df[source_col].unique().tolist() if source_col in df.columns else []
    if len(files) > 1:
        files_sorted = sorted(files)
        test_file = files_sorted[-1]
        train_df = df[df[source_col] != test_file]
        test_df = df[df[source_col] == test_file]
        return train_df, test_df
    else:
        return train_test_split(df, test_size=0.2, random_state=42, stratify=df[LABEL_COL])


def build_xgboost(n_classes: int, class_weights: Optional[dict] = None) -> xgb.XGBClassifier:
    return xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        tree_method="hist",
        random_state=42,
        n_jobs=-1,
    )


def build_random_forest(class_weight=None) -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=150,
        max_depth=15,
        class_weight=class_weight,
        random_state=42,
        n_jobs=-1,
    )


def build_logistic(class_weight=None) -> LogisticRegression:
    return LogisticRegression(
        max_iter=500,
        class_weight=class_weight,
        random_state=42,
        n_jobs=-1,
    )


def evaluate_model(
    model,
    X_test: np.ndarray,
    y_test: np.ndarray,
    le: LabelEncoder,
    scaler: StandardScaler,
) -> dict:
    X_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_scaled)
    y_prob = None
    try:
        y_prob = model.predict_proba(X_scaled)
    except Exception:
        pass

    labels = list(le.classes_)
    report = classification_report(y_test, y_pred, target_names=labels, output_dict=True, zero_division=0)

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision_macro": round(precision_score(y_test, y_pred, average="macro", zero_division=0), 4),
        "recall_macro": round(recall_score(y_test, y_pred, average="macro", zero_division=0), 4),
        "f1_macro": round(f1_score(y_test, y_pred, average="macro", zero_division=0), 4),
        "f1_weighted": round(f1_score(y_test, y_pred, average="weighted", zero_division=0), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred),
        "report": report,
        "y_pred": y_pred,
        "y_prob": y_prob,
        "labels": labels,
    }

    if y_prob is not None and len(labels) > 1:
        try:
            if len(labels) == 2:
                auc_val = roc_auc_score(y_test, y_prob[:, 1])
            else:
                auc_val = roc_auc_score(y_test, y_prob, multi_class="ovr", average="macro")
            metrics["auc_roc"] = round(float(auc_val), 4)
        except Exception:
            metrics["auc_roc"] = None
    else:
        metrics["auc_roc"] = None

    return metrics


def compute_roc_curves(
    y_test: np.ndarray,
    y_prob: np.ndarray,
    le: LabelEncoder,
) -> tuple[dict, dict, dict]:
    fpr_dict, tpr_dict, auc_dict = {}, {}, {}
    classes = le.classes_
    for i, cls in enumerate(classes):
        binary_y = (y_test == i).astype(int)
        if y_prob.shape[1] > i and binary_y.sum() > 0:
            try:
                fpr, tpr, _ = roc_curve(binary_y, y_prob[:, i])
                fpr_dict[cls] = fpr.tolist()
                tpr_dict[cls] = tpr.tolist()
                auc_dict[cls] = round(float(auc(fpr, tpr)), 4)
            except Exception:
                pass
    return fpr_dict, tpr_dict, auc_dict


def compute_pr_curves(
    y_test: np.ndarray,
    y_prob: np.ndarray,
    le: LabelEncoder,
) -> tuple[dict, dict, dict]:
    prec_dict, rec_dict, auc_dict = {}, {}, {}
    classes = le.classes_
    for i, cls in enumerate(classes):
        binary_y = (y_test == i).astype(int)
        if y_prob.shape[1] > i and binary_y.sum() > 0:
            try:
                prec, rec, _ = precision_recall_curve(binary_y, y_prob[:, i])
                prec_dict[cls] = prec.tolist()
                rec_dict[cls] = rec.tolist()
                auc_dict[cls] = round(float(auc(rec, prec)), 4)
            except Exception:
                pass
    return prec_dict, rec_dict, auc_dict


def train_models_comparison(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    strategy: str = "raw",
    label_col: str = LABEL_COL,
) -> dict:
    """
    strategy: 'raw' | 'class_weight' | 'smote' | 'undersample'
    Returns dict with results per model.
    """
    X_train_raw, y_train, le, feat_cols = prepare_features(train_df, label_col)
    X_test_raw, y_test, _, _ = prepare_features(test_df, label_col)

    # Re-encode test labels with same encoder
    y_test = le.transform(test_df[label_col].astype(str))

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_test = scaler.transform(X_test_raw)

    if strategy == "smote":
        try:
            from imblearn.over_sampling import SMOTE
            sm = SMOTE(random_state=42, k_neighbors=min(5, np.bincount(y_train).min() - 1))
            X_train, y_train = sm.fit_resample(X_train, y_train)
        except Exception:
            pass
    elif strategy == "undersample":
        try:
            from imblearn.under_sampling import RandomUnderSampler
            rus = RandomUnderSampler(random_state=42)
            X_train, y_train = rus.fit_resample(X_train, y_train)
        except Exception:
            pass

    cw = "balanced" if strategy == "class_weight" else None

    n_classes = len(le.classes_)
    models = {
        "XGBoost": build_xgboost(n_classes),
        "Random Forest": build_random_forest(cw),
        "Logistic Regression": build_logistic(cw),
    }

    results = {}
    for name, model in models.items():
        try:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            try:
                y_prob = model.predict_proba(X_test)
            except Exception:
                y_prob = None

            acc = accuracy_score(y_test, y_pred)
            p_m = precision_score(y_test, y_pred, average="macro", zero_division=0)
            r_m = recall_score(y_test, y_pred, average="macro", zero_division=0)
            f1_m = f1_score(y_test, y_pred, average="macro", zero_division=0)
            f1_w = f1_score(y_test, y_pred, average="weighted", zero_division=0)

            auc_val = None
            if y_prob is not None:
                try:
                    if n_classes == 2:
                        auc_val = roc_auc_score(y_test, y_prob[:, 1])
                    else:
                        auc_val = roc_auc_score(y_test, y_prob, multi_class="ovr", average="macro")
                except Exception:
                    pass

            results[name] = {
                "model": model,
                "scaler": scaler,
                "le": le,
                "feat_cols": feat_cols,
                "accuracy": round(acc, 4),
                "precision_macro": round(p_m, 4),
                "recall_macro": round(r_m, 4),
                "f1_macro": round(f1_m, 4),
                "f1_weighted": round(f1_w, 4),
                "auc_roc": round(float(auc_val), 4) if auc_val else None,
                "confusion_matrix": confusion_matrix(y_test, y_pred),
                "y_test": y_test,
                "y_pred": y_pred,
                "y_prob": y_prob,
                "labels": list(le.classes_),
            }
        except Exception as e:
            results[name] = {"error": str(e)}

    return results


def compute_learning_curve(
    model,
    X_train: np.ndarray,
    y_train: np.ndarray,
    cv: int = 3,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    train_sizes, train_scores, val_scores = learning_curve(
        model,
        X_train,
        y_train,
        cv=cv,
        scoring="f1_macro",
        train_sizes=np.linspace(0.1, 1.0, 8),
        n_jobs=-1,
    )
    return train_sizes, train_scores.mean(axis=1), val_scores.mean(axis=1)
