# CICIDS Network Analyst

A professional 8-page data analytics Streamlit dashboard for the **CICIDS2017** network intrusion detection dataset. Built for senior analyst workflows — not a demo app.

---

## What Each Page Does

| Page | Purpose |
|------|---------|
| **1 — Data Health Report** | Quality scorecard, null heatmap, duplicate analysis, outlier report, label consistency check, health score 0–100 |
| **2 — EDA** | Class distribution, per-class KDE, feature stats, correlation heatmap, bivariate scatter, temporal flow analysis, skewness ranking |
| **3 — Feature Intelligence** | Variance ranking, point-biserial correlation, mutual information, PCA scree + scatter, dendrogram, t-SNE, per-class top features |
| **4 — Attack Patterns** | Attack profile cards, radar fingerprint chart, TCP flag analysis, port analysis, flow duration violin, behavioral heatmap, anomaly z-scores |
| **5 — Statistical Testing** | Shapiro-Wilk normality, Kruskal-Wallis, Mann-Whitney U, KS drift test, chi-squared, correlation stability, auto summary report |
| **6 — ML Modeling** | XGBoost vs RF vs LR, day-wise split, confusion matrix, per-class metrics, ROC/PR curves, threshold analysis, learning curves, imbalance strategy comparison |
| **7 — SHAP Explainability** | Global summary, SHAP vs gain, per-class SHAP, interaction plot, single-sample waterfall, stability analysis |
| **8 — Report Generator** | Auto-generated full analyst report, top-5 recommendations, findings timeline, export to TXT/CSV/PNG |

---

## How to Download CICIDS2017

1. Go to: https://www.unb.ca/cic/datasets/ids-2017.html
2. Download the **MachineLearningCSV.zip** (also available on Kaggle: search "CICIDS 2017")
3. Extract to get the `MachineLearningCVE/` folder containing 8 CSV files:
   - `Monday-WorkingHours.pcap_ISCX.csv`
   - `Tuesday-WorkingHours.pcap_ISCX.csv`
   - `Wednesday-workingHours.pcap_ISCX.csv`
   - `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv`
   - `Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv`
   - `Friday-WorkingHours-Morning.pcap_ISCX.csv`
   - `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv`
   - `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv`

---

## How to Run

### Prerequisites
- Python 3.10+
- The `MachineLearningCVE/` folder at `../MachineLearningCVE` relative to `cicids_analyst/`
  (i.e., `d:/11 may/intern/MachineLearningCVE/`)

### Install dependencies
```bash
cd cicids_analyst
pip install -r requirements.txt
```

### Run the app
```bash
streamlit run app.py
```

The app will auto-detect the `MachineLearningCVE` folder one level up. You can also upload files manually via the sidebar.

---

## Architecture

```
cicids_analyst/
├── app.py                          # Entry point, sidebar, routing
├── utils/
│   ├── styles.py                   # CSS, colors, HTML helpers
│   ├── data_loader.py              # load_raw_data(), clean_data(), cached
│   ├── charts.py                   # Dark matplotlib/plotly helpers
│   ├── stats.py                    # Statistical test wrappers
│   └── ml.py                       # Model training, evaluation
├── pages/
│   ├── page_01_data_health.py
│   ├── page_02_eda.py
│   ├── page_03_feature_intelligence.py
│   ├── page_04_attack_patterns.py
│   ├── page_05_statistical_testing.py
│   ├── page_06_ml_modeling.py
│   ├── page_07_shap_explainability.py
│   └── page_08_report_generator.py
├── requirements.txt
└── README.md
```

---

## Design System

- **Theme:** Full dark — `#0d1117` background, `#161b22` cards
- **Font:** IBM Plex Sans + IBM Plex Mono
- **Accent:** `#58a6ff` (blue), `#3fb950` (green), `#f85149` (red), `#d29922` (yellow)
- **Attack colors:** BENIGN=green, DDoS=orange-red, PortScan=yellow, Bot=purple, Brute Force=blue, Web=teal

---

## Performance Notes

- All data loading uses `@st.cache_data`
- Heavy operations (t-SNE, SHAP, model training) only run on button click
- Default sample sizes: t-SNE=2000, SHAP=500, scatter=5000
- Full dataset (~2.5M rows) may take 2–3 minutes to load and clean on first run
