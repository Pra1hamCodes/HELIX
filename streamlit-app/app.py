"""CICIDS Network Analyst — Cyber-Intelligence Dashboard"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="CICIDS Network Analyst",
    page_icon="🔒",
    layout="wide",
    initial_sidebar_state="expanded",
)

from utils.styles import inject_css, COLORS, page_header, metric_card, insight_box
from utils.data_loader import load_raw_data, clean_data, LABEL_COL, SOURCE_COL, DATA_DIR

inject_css()

# ── Matrix rain canvas (full-screen background) ───────────────────────────────
MATRIX_HTML = """
<canvas id="matrix" style="
    position:fixed; top:0; left:0; width:100%; height:100%;
    z-index:0; pointer-events:none; opacity:0.045;
"></canvas>
<script>
(function(){
  const c = document.getElementById('matrix');
  if(!c) return;
  const ctx = c.getContext('2d');
  let W, H, cols, drops;
  const chars = '01アイウエオカキクケコ∑∆ΩΨ∞≠ABCDEF0123456789';
  const fontSize = 13;
  function init() {
    W = c.width = window.innerWidth;
    H = c.height = window.innerHeight;
    cols = Math.floor(W / fontSize);
    drops = Array(cols).fill(1);
  }
  function draw() {
    ctx.fillStyle = 'rgba(2,4,9,0.05)';
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#00f5ff';
    ctx.font = fontSize + 'px JetBrains Mono, monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random()*chars.length)];
      ctx.globalAlpha = Math.random() * 0.5 + 0.1;
      ctx.fillText(ch, i * fontSize, y * fontSize);
      ctx.globalAlpha = 1;
      if(y * fontSize > H && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  }
  init();
  window.addEventListener('resize', init);
  setInterval(draw, 50);
})();
</script>
"""
components.html(MATRIX_HTML, height=0, scrolling=False)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    # Logo / brand
    st.markdown("""
<div style="padding:20px 0 8px; border-bottom:1px solid rgba(0,245,255,0.1); margin-bottom:16px;">
  <div style="
    font-family:'Oxanium',sans-serif; font-size:0.65rem; color:#3a5070;
    text-transform:uppercase; letter-spacing:0.18em; margin-bottom:6px;
  ">◈ SYSTEM STATUS: ONLINE</div>
  <div style="
    font-family:'Oxanium',sans-serif; font-size:1.05rem; font-weight:800;
    background:linear-gradient(135deg,#00f5ff,#00ff88);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; letter-spacing:0.06em;
  ">CICIDS ANALYST</div>
  <div style="
    font-family:'Syne',sans-serif; font-size:0.72rem; color:#3a5070;
    margin-top:2px; letter-spacing:0.04em;
  ">Network Threat Intelligence v2.0</div>
</div>
""", unsafe_allow_html=True)

    # File uploader
    st.markdown("""
<div style="font-family:'Oxanium',sans-serif; font-size:0.65rem; color:#3a5070;
text-transform:uppercase; letter-spacing:0.12em; margin-bottom:6px;">
◈ Data Source
</div>""", unsafe_allow_html=True)

    uploaded = st.file_uploader(
        "Upload CSV files",
        type=["csv"],
        accept_multiple_files=True,
        label_visibility="collapsed",
        key="uploader",
    )

    default_dir = st.text_input(
        "Directory path",
        value=str(DATA_DIR),
        label_visibility="collapsed",
    )

    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    st.divider()

    # Navigation
    st.markdown("""
<div style="font-family:'Oxanium',sans-serif; font-size:0.65rem; color:#3a5070;
text-transform:uppercase; letter-spacing:0.12em; margin:12px 0 8px;">
◈ Navigation
</div>""", unsafe_allow_html=True)

    NAV_ITEMS = [
        ("📊", "Data Health Report",         "Quality · Nulls · Outliers"),
        ("🔍", "Exploratory Data Analysis",  "Distributions · Correlations"),
        ("🧠", "Feature Intelligence",       "PCA · MI · t-SNE"),
        ("⚔️", "Attack Pattern Analysis",   "Fingerprints · Radar · Flags"),
        ("📐", "Statistical Testing",        "KW · MW-U · KS Drift"),
        ("🤖", "ML Modeling & Evaluation",  "XGBoost · ROC · Threshold"),
        ("💡", "SHAP Explainability",        "Waterfall · Stability"),
        ("📋", "Analyst Report Generator",  "Export · Recommendations"),
    ]

    for ico, name, hint in NAV_ITEMS:
        key = f"nav_{name}"
        if key not in st.session_state:
            st.session_state[key] = False

    page = st.radio(
        "nav",
        [f"{ico}  {name}" for ico, name, _ in NAV_ITEMS],
        label_visibility="collapsed",
        key="main_nav",
    )

    st.divider()
    # Data status widget in sidebar
    df_loaded = st.session_state.get("df") is not None
    n_rows = len(st.session_state["df"]) if df_loaded else 0
    n_files = len(st.session_state.get("file_names", []))
    st.markdown(f"""
<div style="
    background: {'rgba(0,255,136,0.05)' if df_loaded else 'rgba(255,34,68,0.05)'};
    border: 1px solid {'rgba(0,255,136,0.2)' if df_loaded else 'rgba(255,34,68,0.2)'};
    border-radius:8px; padding:12px; margin-top:4px; text-align:center;
">
  <div style="font-family:'Oxanium',sans-serif; font-size:0.65rem; color:#3a5070;
    text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Dataset</div>
  <div style="font-family:'JetBrains Mono',monospace; font-size:0.85rem;
    color:{'#00ff88' if df_loaded else '#ff2244'}; font-weight:700;">
    {'■ LOADED' if df_loaded else '□ NO DATA'}
  </div>
  {'<div style="font-size:0.72rem;color:#3a5070;margin-top:4px;font-family:Syne,sans-serif;">' + f'{n_rows:,} rows · {n_files} files</div>' if df_loaded else ''}
</div>
""", unsafe_allow_html=True)

# ── Data loading ──────────────────────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def _load_uploaded(file_dict: dict):
    return load_raw_data(file_bytes=file_dict)

@st.cache_data(show_spinner=False)
def _load_dir(data_dir: str):
    return load_raw_data(data_dir=data_dir)

raw_df = None
file_names: list = []

if uploaded:
    file_dict = {f.name: f.read() for f in uploaded}
    with st.spinner("🔍 Parsing uploaded files…"):
        raw_df, file_names = _load_uploaded(file_dict)
elif default_dir and os.path.isdir(default_dir):
    with st.spinner(f"⚡ Auto-loading from {default_dir}…"):
        raw_df, file_names = _load_dir(default_dir)

if raw_df is not None:
    ck = len(raw_df)
    if st.session_state.get("clean_key") != ck:
        with st.spinner("🧹 Cleaning data pipeline…"):
            cleaned_df, orig_rows, clean_rows, clip_info = clean_data(raw_df)
        st.session_state.update({
            "df": cleaned_df, "raw_df": raw_df,
            "file_names": file_names, "orig_rows": orig_rows,
            "clean_rows": clean_rows, "clip_info": clip_info,
            "clean_key": ck,
        })

# ── No-data landing page ──────────────────────────────────────────────────────
def _landing():
    components.html("""
<div style="
    font-family: 'Oxanium', monospace;
    text-align: center;
    padding: 60px 20px;
    animation: fadeIn 0.8s ease;
">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@700;800&display=swap');
    @keyframes fadeIn { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
    .ring {
      width:120px; height:120px; border-radius:50%;
      border: 2px solid rgba(0,245,255,0.2);
      border-top-color: #00f5ff;
      animation: spin 3s linear infinite;
      margin: 0 auto 30px;
      position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    @keyframes spin { to{transform:rotate(360deg)} }
    .inner-ring {
      width:80px; height:80px; border-radius:50%;
      border: 1px solid rgba(0,255,136,0.3);
      border-bottom-color: #00ff88;
      animation: spin 2s linear infinite reverse;
      position: absolute;
      display: flex; align-items:center; justify-content:center;
    }
    .dot { width:12px; height:12px; border-radius:50%; background:#00f5ff;
      box-shadow: 0 0 20px #00f5ff; animation: pulse 2s ease infinite; }
  </style>
  <div class="ring">
    <div class="inner-ring">
      <div class="dot"></div>
    </div>
  </div>
  <div style="font-size:1.8rem; font-weight:800;
    background:linear-gradient(135deg,#00f5ff,#00ff88);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; margin-bottom:12px;">
    AWAITING DATA FEED
  </div>
  <div style="color:#3a5070; font-size:0.9rem; letter-spacing:0.08em; margin-bottom:30px;">
    Upload CICIDS2017 CSV files via the sidebar to initialize analysis
  </div>
  <div style="display:inline-block; padding:10px 24px;
    border:1px solid rgba(0,245,255,0.4); border-radius:6px;
    color:#00f5ff; font-size:0.8rem; letter-spacing:0.1em;
    animation: pulse 2s ease infinite;">
    ◈ USE SIDEBAR TO UPLOAD OR SET DIRECTORY PATH
  </div>
</div>
""", height=320)
    st.stop()


# ── Route to page ─────────────────────────────────────────────────────────────
df        = st.session_state.get("df")
raw_df_s  = st.session_state.get("raw_df")
fnames_s  = st.session_state.get("file_names", [])
orig_rows = st.session_state.get("orig_rows", 0)
clean_rows= st.session_state.get("clean_rows", 0)
clip_info = st.session_state.get("clip_info", {})

if df is None:
    _landing()

p = page.split("  ", 1)[-1] if "  " in page else page

if "Data Health" in p:
    from pages import page_01_data_health as pg
    pg.render(df, raw_df_s, fnames_s, orig_rows, clean_rows, clip_info)
elif "Exploratory" in p:
    from pages import page_02_eda as pg
    pg.render(df)
elif "Feature Intelligence" in p:
    from pages import page_03_feature_intelligence as pg
    pg.render(df)
elif "Attack Pattern" in p:
    from pages import page_04_attack_patterns as pg
    pg.render(df)
elif "Statistical" in p:
    from pages import page_05_statistical_testing as pg
    pg.render(df, fnames_s)
elif "ML Modeling" in p:
    from pages import page_06_ml_modeling as pg
    pg.render(df)
elif "SHAP" in p:
    from pages import page_07_shap_explainability as pg
    pg.render(df)
elif "Report" in p:
    from pages import page_08_report_generator as pg
    pg.render(df, fnames_s, orig_rows, clean_rows, clip_info)

# ── Global footer (injected at bottom of every page) ──────────────────────────
st.markdown("""
<style>
.cicids-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 9999;
    background: rgba(2,4,9,0.92);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(0,245,255,0.12);
    padding: 10px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.footer-brand {
    font-family: 'Oxanium', sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    background: linear-gradient(90deg, #00f5ff, #00ff88);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 0.1em;
}
.footer-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    color: #3a5070;
    letter-spacing: 0.06em;
}
.footer-github {
    font-family: 'Oxanium', sans-serif;
    font-size: 0.72rem;
    color: #00f5ff;
    text-decoration: none;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
    font-weight: 600;
}
.footer-github:hover {
    color: #00ff88;
    text-shadow: 0 0 12px rgba(0,255,136,0.6);
}
.footer-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #00ff88;
    box-shadow: 0 0 8px #00ff88;
    animation: pulse-dot 2s ease infinite;
}
@keyframes pulse-dot {
    0%,100% { opacity:0.5; transform:scale(1); }
    50% { opacity:1; transform:scale(1.4); }
}
</style>

<div class="cicids-footer">
  <div style="display:flex; align-items:center; gap:16px;">
    <span class="footer-dot"></span>
    <span class="footer-brand">Pra1ham codes</span>
  </div>
  <div class="footer-meta">
    CICIDS NETWORK ANALYST &nbsp;·&nbsp; THREAT INTELLIGENCE PLATFORM
  </div>
  <a class="footer-github"
     href="https://github.com/Pra1hamcodes"
     target="_blank" rel="noopener">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#00f5ff">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
      0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695
      -.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99
      .105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225
      -.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405
      c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225
      0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3
      0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
    Pra1ham codes
  </a>
</div>
""", unsafe_allow_html=True)
