# HELIX — Network Threat Intelligence Dashboard

A fully in-browser network intrusion detection analytics platform built for the **CICIDS2017** dataset. Upload raw CSV files and get interactive ML modeling, statistical testing, feature analysis, temporal patterns, and auto-generated analytical insights — all computed client-side with no backend required.

---

## What it does

HELIX ingests one or more CICIDS2017 CSV files directly in the browser, cleans and merges them, then provides nine analysis modules:

| Module | What you get |
|--------|-------------|
| **Data Health** | Missing value audit, class distribution, per-file quality report |
| **EDA** | Feature distributions, KDE overlays, class-mean comparisons, scatter plots |
| **Feature Intelligence** | Variance ranking, Pearson correlation heatmap, redundancy detection, PCA 2D projection, Mutual Information |
| **Attack Patterns** | Per-class radar signature, anomaly z-score matrix, flow fingerprints |
| **Statistical Testing** | Mann-Whitney U + Welch's t-test, Cohen's d with bootstrap 95% CI, BH-FDR correction |
| **ML Modeling** | Decision Tree (class-weighted CART) + Gaussian Naïve Bayes, stratified 5-fold CV, ROC/PR curves, per-class AUC |
| **Temporal Analysis** | Attack distribution by capture day, stacked bar by class, cross-tabulation |
| **Intelligence Brief** | Auto-generated dataset health score, critical issues, analytical findings, recommendations |
| **Report Generator** | Full analyst report pulling results from all modules |

---

## Project structure

```
HELIX/
├── src/
│   ├── App.jsx                         # Route definitions, layout shell
│   ├── main.jsx                        # React 18 entry point
│   ├── index.css                       # Global styles, keyframe animations
│   │
│   ├── pages/
│   │   ├── LandingPage.jsx             # Hero, drag-and-drop upload, processing screen
│   │   ├── DataHealth.jsx              # Missing values, class counts, file quality
│   │   ├── EDA.jsx                     # Distributions, KDE, scatter, class means
│   │   ├── FeatureIntelligence.jsx     # Variance, correlation, PCA, MI
│   │   ├── AttackPatterns.jsx          # Radar profiles, anomaly z-scores
│   │   ├── StatisticalTesting.jsx      # MW-U, Welch-t, Cohen's d, BH-FDR
│   │   ├── MLModeling.jsx              # Decision Tree, GNB, CV, ROC/PR
│   │   ├── TemporalAnalysis.jsx        # Day-by-day attack breakdown
│   │   ├── InsightsPage.jsx            # Auto-generated intelligence brief
│   │   └── ReportGenerator.jsx        # Full analyst report
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.jsx             # Color-coded navigation, dataset status
│   │   │   └── Footer.jsx              # Fixed footer with branding
│   │   ├── Charts/
│   │   │   ├── BarChart.jsx            # Horizontal / vertical bar (Recharts)
│   │   │   ├── LineChart.jsx           # Time-series line chart
│   │   │   ├── ROCChart.jsx            # ROC curve with AUC annotation
│   │   │   ├── PRChart.jsx             # Precision-recall curve
│   │   │   ├── HeatmapChart.jsx        # Pearson correlation heatmap
│   │   │   ├── RadarChart.jsx          # Per-class radar signatures
│   │   │   ├── ScatterPlot.jsx         # 2D scatter with class coloring
│   │   │   ├── PCAScatter.jsx          # PCA 2D projection scatter
│   │   │   ├── PieChart.jsx            # Class distribution donut
│   │   │   ├── ClassMeanChart.jsx      # Per-class feature means bar
│   │   │   └── ComposedHistKDE.jsx     # Histogram + KDE overlay
│   │   ├── MatrixRain.jsx              # Canvas-based matrix rain background
│   │   └── UI/
│   │       ├── PageHeader.jsx
│   │       ├── MetricCard.jsx
│   │       ├── SectionHeader.jsx
│   │       ├── InsightBox.jsx
│   │       └── LoadingSpinner.jsx
│   │
│   ├── store/
│   │   └── useDataStore.js             # Zustand global state (rows, summaries, UI)
│   │
│   └── utils/
│       ├── dataProcessor.js            # CSV parsing, cleaning, merging (PapaParse)
│       ├── ml.js                       # Decision Tree, GNB, PCA, MI, ROC/PR, BH-FDR
│       ├── stats.js                    # mean, std, variance, t-distribution CDF
│       └── colors.js                   # Attack class color palette
│
├── streamlit-app/                      # Python Streamlit version (alternative UI)
│   ├── app.py
│   ├── requirements.txt
│   ├── pages/
│   │   ├── page_01_data_health.py
│   │   ├── page_02_eda.py
│   │   ├── page_03_feature_intelligence.py
│   │   ├── page_04_attack_patterns.py
│   │   ├── page_05_statistical_testing.py
│   │   ├── page_06_ml_modeling.py
│   │   ├── page_07_shap_explainability.py
│   │   └── page_08_report_generator.py
│   └── utils/
│       ├── data_loader.py
│       ├── ml.py
│       ├── stats.py
│       ├── charts.py
│       └── styles.py
│
├── dataset/
│   └── README.md                       # Dataset download instructions
│
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Tech stack — React dashboard

| Layer | Library | Version |
|-------|---------|---------|
| UI framework | React | 18.3 |
| Build tool | Vite | 5.2 |
| Routing | React Router DOM | 6.23 |
| State management | Zustand | 4.5 |
| Charts | Recharts | 2.12 |
| CSV parsing | PapaParse | 5.4 |
| Styling | Tailwind CSS | 3.4 |
| Icons | React Icons (Remix) | 5.2 |
| Animations | Framer Motion | 11.2 |
| Data utils | D3 | 7.9 |

All analytics run in the browser — no server, no API calls, no data leaves the device.

---

## Tech stack — Streamlit app

| Library | Purpose |
|---------|---------|
| Streamlit | UI framework |
| Pandas / NumPy | Data manipulation |
| Plotly / Matplotlib / Seaborn | Charts |
| Scikit-learn | ML modeling, preprocessing |
| XGBoost | Gradient boosted tree |
| SHAP | Model explainability |
| SciPy | Statistical tests |
| imbalanced-learn | SMOTE oversampling |

---

## Analytics techniques

### Feature analysis
- **Variance ranking** — Features sorted by sample variance to identify high-information columns
- **Pearson correlation** — Full correlation matrix on top-20 variance features; redundant pairs flagged at |r| > 0.9
- **Mutual Information** — `MI(X; Y) = H(Y) − H(Y|X_binned)`, discretized into 10 equal-width bins, 4000-row sample
- **PCA** — Power-iteration covariance decomposition on top-20 variance features, projected to 2D
- **Anomaly z-scores** — `z = (class_mean − global_mean) / global_std` per feature per class

### Statistical testing
- **Mann-Whitney U test** — Non-parametric rank-based comparison of benign vs malicious distributions; tie-corrected, normal approximation
- **Welch's t-test** — Unequal-variance t-test with exact t-distribution CDF (Hart approximation)
- **Cohen's d** — Standardized effect size for each feature
- **Bootstrap 95% CI** — B=500 resamples of Cohen's d, `[2.5th, 97.5th]` percentile interval
- **Benjamini-Hochberg FDR correction** — Adjusts p-values for multiple testing; controls false discovery rate at 5%

### ML modeling
- **Decision Tree (CART)** — Class-weighted Gini impurity: `w_c = N / (K × n_c)`; weights thread through every recursive `buildNode` call
- **Gaussian Naïve Bayes** — Log-space likelihood with `1e-9` variance floor; softmax scores for ROC/PR
- **Stratified 5-fold CV** — Folds preserve class proportions; reports mean ± std for accuracy, macro-F1, and AUC
- **ROC curve** — Threshold sweep over scorer output; AUC by trapezoidal rule
- **Precision-Recall curve** — Same sweep; AP (area under PR) reported
- **Per-class AUC** — One-vs-rest AUC for each attack class

---

## Dataset

**CIC-IDS-2017** — Canadian Institute for Cybersecurity, University of New Brunswick.

8 CSV files, ~847 MB total, ~79 network flow features per row, labeled by attack type:

| Day | File | Attacks |
|-----|------|---------|
| Monday | `Monday-WorkingHours.pcap_ISCX.csv` | BENIGN only |
| Tuesday | `Tuesday-WorkingHours.pcap_ISCX.csv` | FTP-Patator, SSH-Patator |
| Wednesday | `Wednesday-workingHours.pcap_ISCX.csv` | DoS Hulk, DoS GoldenEye, DoS Slowloris, Heartbleed |
| Thursday AM | `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv` | Brute Force, XSS, SQL Injection |
| Thursday PM | `Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv` | Infiltration |
| Friday AM | `Friday-WorkingHours-Morning.pcap_ISCX.csv` | Bot, PortScan |
| Friday PM (1) | `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv` | PortScan |
| Friday PM (2) | `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv` | DDoS |

Download: https://www.unb.ca/cic/datasets/ids-2017.html  
Kaggle mirror: https://www.kaggle.com/datasets/cicdataset/cicids2017

---

## Running the React dashboard

```bash
# Install dependencies
npm install

# Start dev server (opens at http://localhost:5173)
npm run dev

# Build for production
npm run build
```

Then open the app, drag and drop one or more CICIDS2017 CSV files onto the landing page, and click **Launch Analysis**.

---

## Running the Streamlit app

```bash
cd streamlit-app

# Install Python dependencies
pip install -r requirements.txt

# Run
streamlit run app.py
```

---

## Design

Cyberpunk / glassmorphism aesthetic. Dark background (`#020409`), neon cyan (`#00f5ff`), green (`#00ff88`), purple (`#7b2fff`), red (`#ff2244`).

Fonts:
- **Chakra Petch** — Hero title, large display
- **Oxanium** — UI headers, navigation, buttons
- **JetBrains Mono** — Data values, code, metrics
- **Syne** — Body text

Landing page features a canvas radar sweep animation and matrix rain background. All page transitions use staggered reveal animations via Framer Motion and CSS keyframes.

---

## Author

Built by [Pra1ham codes](https://github.com/Pra1hamcodes)
