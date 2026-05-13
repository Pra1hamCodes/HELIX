"""
CICIDS Network Analyst — Cyber-Intelligence Design System
Aesthetic: Glassmorphism + Neon + Matrix + HUD
"""
import streamlit as st

# ── Color tokens ─────────────────────────────────────────────────────────────
COLORS = {
    "bg": "#020409",
    "surface": "#080d1a",
    "card": "#0b1220",
    "glass": "rgba(11,18,32,0.75)",
    "border": "rgba(0,245,255,0.12)",
    "border_bright": "rgba(0,245,255,0.45)",
    "accent": "#00f5ff",
    "accent2": "#00ff88",
    "purple": "#7b2fff",
    "danger": "#ff2244",
    "warning": "#ffd60a",
    "muted": "#3a5070",
    "text": "#cce8ff",
    "text_dim": "#5a7a9a",
}

ATTACK_COLORS = {
    "BENIGN": "#00ff88",
    "DoS Hulk": "#ff2244",
    "DoS GoldenEye": "#ff4466",
    "DoS slowloris": "#ff3355",
    "DoS Slowhttptest": "#cc1133",
    "DDoS": "#ff5533",
    "FTP-Patator": "#00c8ff",
    "SSH-Patator": "#0099ff",
    "PortScan": "#ffd60a",
    "Bot": "#aa44ff",
    "Web Attack - Brute Force": "#00ff88",
    "Web Attack - XSS": "#44ffaa",
    "Web Attack - Sql Injection": "#22ddff",
    "Infiltration": "#ff9900",
    "Heartbleed": "#ff66aa",
}

LABEL_COL = "Label"


def get_attack_color(label: str) -> str:
    label = str(label).strip()
    if label in ATTACK_COLORS:
        return ATTACK_COLORS[label]
    lu = label.upper()
    if "BENIGN" in lu: return "#00ff88"
    if "DDOS" in lu:   return "#ff5533"
    if "DOS" in lu:    return "#ff2244"
    if "PORTSCAN" in lu: return "#ffd60a"
    if "BOT" in lu:    return "#aa44ff"
    if "BRUTE" in lu or "FTP" in lu or "SSH" in lu: return "#00c8ff"
    if "WEB" in lu:    return "#44ffaa"
    if "INFILTRATION" in lu: return "#ff9900"
    if "HEARTBLEED" in lu: return "#ff66aa"
    return "#3a5070"


# ── Master CSS injection ──────────────────────────────────────────────────────
def inject_css():
    st.markdown("""
<style>
/* ═══ FONTS ═══════════════════════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;500;600;700&display=swap');

/* ═══ GLOBAL RESET ════════════════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; }

html, body { overflow-x: hidden; }

.stApp {
    background: #020409;
    font-family: 'Syne', sans-serif;
    color: #cce8ff;
    min-height: 100vh;
}

[data-testid="stAppViewContainer"] {
    background: #020409;
}

/* Circuit grid bg */
[data-testid="stAppViewContainer"]::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
        linear-gradient(rgba(0,245,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,245,255,0.025) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
}

/* Radial glow backdrop */
[data-testid="stAppViewContainer"]::after {
    content: '';
    position: fixed;
    top: -40%;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 600px;
    background: radial-gradient(ellipse, rgba(0,245,255,0.04) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
}

.block-container {
    padding: 0 2rem 6rem 2rem;
    max-width: 1400px;
    position: relative;
    z-index: 1;
}

/* ═══ SIDEBAR ══════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] {
    background: rgba(8,13,26,0.95) !important;
    border-right: 1px solid rgba(0,245,255,0.12) !important;
    backdrop-filter: blur(20px);
}

[data-testid="stSidebar"] > div:first-child {
    background: transparent !important;
}

section[data-testid="stSidebarContent"] {
    background: transparent !important;
    padding-top: 0 !important;
}

/* ═══ TYPOGRAPHY ═══════════════════════════════════════════════════════════ */
h1, h2, h3, h4, h5, h6 {
    font-family: 'Oxanium', sans-serif !important;
    color: #cce8ff !important;
    letter-spacing: 0.03em;
}

p, li, span, div, label {
    font-family: 'Syne', sans-serif;
    color: #cce8ff;
}

code, pre, .stCode {
    font-family: 'JetBrains Mono', monospace !important;
}

/* ═══ METRIC (st.metric) ═══════════════════════════════════════════════════ */
[data-testid="stMetric"] {
    background: rgba(11,18,32,0.8) !important;
    border: 1px solid rgba(0,245,255,0.15) !important;
    border-radius: 12px !important;
    padding: 16px 20px !important;
    transition: all 0.3s ease;
    backdrop-filter: blur(12px);
}

[data-testid="stMetric"]:hover {
    border-color: rgba(0,245,255,0.5) !important;
    box-shadow: 0 0 20px rgba(0,245,255,0.08), 0 0 40px rgba(0,245,255,0.04);
    transform: translateY(-2px);
}

[data-testid="stMetricValue"] {
    font-family: 'JetBrains Mono', monospace !important;
    color: #00f5ff !important;
    font-weight: 700 !important;
    font-size: 1.6rem !important;
}

[data-testid="stMetricLabel"] {
    font-family: 'Oxanium', sans-serif !important;
    color: #3a5070 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
    font-size: 0.72rem !important;
}

/* ═══ BUTTONS ══════════════════════════════════════════════════════════════ */
.stButton > button {
    background: transparent !important;
    border: 1px solid rgba(0,245,255,0.4) !important;
    color: #00f5ff !important;
    border-radius: 6px !important;
    font-family: 'Oxanium', sans-serif !important;
    font-weight: 600 !important;
    letter-spacing: 0.06em !important;
    text-transform: uppercase !important;
    font-size: 0.8rem !important;
    padding: 10px 20px !important;
    transition: all 0.25s ease !important;
    position: relative;
    overflow: hidden;
}

.stButton > button::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(0,245,255,0.08), transparent);
    transform: translateX(-100%);
    transition: transform 0.4s ease;
}

.stButton > button:hover {
    background: rgba(0,245,255,0.08) !important;
    border-color: #00f5ff !important;
    box-shadow: 0 0 20px rgba(0,245,255,0.2), 0 0 40px rgba(0,245,255,0.05) !important;
    transform: translateY(-1px) !important;
    color: #ffffff !important;
}

.stButton > button:hover::before {
    transform: translateX(100%);
}

/* ═══ INPUTS & SELECTS ═════════════════════════════════════════════════════ */
.stSelectbox > div > div,
.stMultiSelect > div,
.stTextInput > div > div > input {
    background: rgba(11,18,32,0.9) !important;
    border: 1px solid rgba(0,245,255,0.2) !important;
    border-radius: 8px !important;
    color: #cce8ff !important;
    font-family: 'JetBrains Mono', monospace !important;
    transition: border-color 0.2s;
}

.stSelectbox > div > div:focus-within,
.stTextInput > div > div > input:focus {
    border-color: rgba(0,245,255,0.6) !important;
    box-shadow: 0 0 12px rgba(0,245,255,0.1) !important;
}

/* ═══ TABS ══════════════════════════════════════════════════════════════════ */
.stTabs [data-baseweb="tab-list"] {
    background: rgba(8,13,26,0.9) !important;
    border-bottom: 1px solid rgba(0,245,255,0.15) !important;
    gap: 2px;
    padding: 4px;
    border-radius: 10px 10px 0 0;
}

.stTabs [data-baseweb="tab"] {
    color: #3a5070 !important;
    font-family: 'Oxanium', sans-serif !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em !important;
    border-radius: 8px !important;
    padding: 8px 16px !important;
    transition: all 0.2s;
}

.stTabs [aria-selected="true"] {
    color: #00f5ff !important;
    background: rgba(0,245,255,0.08) !important;
    border-bottom: 2px solid #00f5ff !important;
}

/* ═══ DATAFRAME ════════════════════════════════════════════════════════════ */
[data-testid="stDataFrame"] {
    border: 1px solid rgba(0,245,255,0.12) !important;
    border-radius: 10px !important;
    overflow: hidden;
    background: rgba(11,18,32,0.8) !important;
}

/* ═══ EXPANDER ════════════════════════════════════════════════════════════ */
[data-testid="stExpander"] {
    border: 1px solid rgba(0,245,255,0.12) !important;
    border-radius: 10px !important;
    background: rgba(11,18,32,0.6) !important;
    backdrop-filter: blur(10px);
    transition: border-color 0.3s;
}

[data-testid="stExpander"]:hover {
    border-color: rgba(0,245,255,0.3) !important;
}

/* ═══ RADIO ════════════════════════════════════════════════════════════════ */
.stRadio > label {
    color: #3a5070 !important;
    font-family: 'Oxanium', sans-serif !important;
    font-size: 0.8rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
}

/* ═══ SLIDER ═══════════════════════════════════════════════════════════════ */
.stSlider > div [data-baseweb="slider"] {
    background: rgba(0,245,255,0.15) !important;
}

/* ═══ PROGRESS ═════════════════════════════════════════════════════════════ */
.stProgress > div > div > div {
    background: linear-gradient(90deg, #00f5ff, #00ff88) !important;
}

/* ═══ DIVIDER ══════════════════════════════════════════════════════════════ */
hr {
    border: none !important;
    height: 1px !important;
    background: linear-gradient(90deg, transparent, rgba(0,245,255,0.3), transparent) !important;
    margin: 1rem 0 !important;
}

/* ═══ FILE UPLOADER ════════════════════════════════════════════════════════ */
[data-testid="stFileUploader"] {
    background: rgba(11,18,32,0.6) !important;
    border: 1px dashed rgba(0,245,255,0.3) !important;
    border-radius: 10px !important;
    transition: all 0.3s;
}

[data-testid="stFileUploader"]:hover {
    border-color: rgba(0,245,255,0.7) !important;
    background: rgba(0,245,255,0.04) !important;
}

/* ═══ SCROLLBAR ════════════════════════════════════════════════════════════ */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: #020409; }
::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #00f5ff, #7b2fff);
    border-radius: 3px;
}

/* ═══ ALERT / INFO BOXES ═══════════════════════════════════════════════════ */
.stAlert { border-radius: 10px !important; }

/* ═══ ANIMATIONS ═══════════════════════════════════════════════════════════ */
@keyframes neonPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(0,245,255,0.3), 0 0 20px rgba(0,245,255,0.1); }
    50% { box-shadow: 0 0 16px rgba(0,245,255,0.6), 0 0 40px rgba(0,245,255,0.2); }
}

@keyframes gradientBorder {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}

@keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
}

@keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes dataStream {
    0% { background-position: 0% 0%; }
    100% { background-position: 0% 100%; }
}

@keyframes glitch {
    0%, 100% { clip-path: inset(0 0 98% 0); transform: translate(-2px); }
    10% { clip-path: inset(30% 0 50% 0); transform: translate(2px); }
    20% { clip-path: inset(70% 0 10% 0); transform: translate(-1px); }
    30% { clip-path: inset(10% 0 85% 0); transform: translate(1px); }
    40% { clip-path: inset(50% 0 40% 0); transform: translate(0); }
}

@keyframes breathe {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.02); }
}

@keyframes rotate360 {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

@keyframes slideRight {
    from { width: 0; }
    to { width: 100%; }
}

/* ═══ WIDGET LABEL ═════════════════════════════════════════════════════════ */
[data-testid="stWidgetLabel"] {
    color: #3a5070 !important;
    font-family: 'Oxanium', sans-serif !important;
    font-size: 0.75rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
}

/* Selection */
::selection {
    background: rgba(0,245,255,0.2);
    color: #ffffff;
}
</style>
""", unsafe_allow_html=True)


# ── HTML component builders ───────────────────────────────────────────────────

def page_header(title: str, subtitle: str = "") -> str:
    sub_html = (
        f'<div class="ph-sub">{subtitle}</div>' if subtitle else ""
    )
    return f"""
<div class="page-header-wrap" style="
    animation: fadeSlideUp 0.5s ease forwards;
    margin-bottom: 28px;
    padding: 24px 0 20px;
    border-bottom: 1px solid rgba(0,245,255,0.1);
">
  <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
    <div style="width:3px; height:32px; background:linear-gradient(180deg,#00f5ff,#7b2fff);
    border-radius:2px; box-shadow: 0 0 10px rgba(0,245,255,0.6);"></div>
    <h1 style="
        font-family:'Oxanium',sans-serif; font-size:2rem; font-weight:800;
        background:linear-gradient(135deg, #00f5ff 0%, #cce8ff 50%, #00ff88 100%);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent;
        background-clip:text; margin:0; letter-spacing:0.04em;
    ">{title}</h1>
  </div>
  <div style="
    font-family:'Syne',sans-serif; font-size:0.88rem; color:#3a5070;
    padding-left:13px; letter-spacing:0.02em;
  ">{subtitle}</div>
</div>"""


def metric_card(label: str, value: str, delta: str = "", color: str = "#00f5ff",
                icon: str = "") -> str:
    delta_html = (
        f'<div style="font-size:0.72rem;color:#3a5070;margin-top:6px;'
        f'font-family:\'Syne\',sans-serif;">{delta}</div>'
    ) if delta else ""
    icon_html = f'<div style="font-size:1.4rem;margin-bottom:6px;">{icon}</div>' if icon else ""
    return f"""
<div style="
    background: rgba(11,18,32,0.85);
    border: 1px solid rgba(0,245,255,0.12);
    border-radius: 12px;
    padding: 20px 22px;
    margin: 6px 0;
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
    animation: fadeSlideUp 0.4s ease forwards;
    position: relative;
    overflow: hidden;
" onmouseover="
    this.style.borderColor='rgba(0,245,255,0.45)';
    this.style.transform='translateY(-3px)';
    this.style.boxShadow='0 0 24px rgba(0,245,255,0.1), 0 8px 32px rgba(0,0,0,0.4)';
" onmouseout="
    this.style.borderColor='rgba(0,245,255,0.12)';
    this.style.transform='translateY(0)';
    this.style.boxShadow='none';
">
  <div style="
    position:absolute; top:0; right:0; width:60px; height:60px;
    background: radial-gradient(circle at top right, {color}18, transparent 70%);
    pointer-events:none;
  "></div>
  {icon_html}
  <div style="
    font-family:'Oxanium',sans-serif; font-size:0.68rem; color:#3a5070;
    text-transform:uppercase; letter-spacing:0.1em; font-weight:600;
    margin-bottom:8px;
  ">{label}</div>
  <div style="
    font-family:'JetBrains Mono',monospace; font-size:1.9rem;
    font-weight:700; color:{color}; line-height:1; letter-spacing:-0.02em;
    text-shadow: 0 0 20px {color}55;
  ">{value}</div>
  {delta_html}
</div>"""


def insight_box(text: str, variant: str = "info") -> str:
    cfg = {
        "info":    ("#00f5ff", "rgba(0,245,255,0.06)",    "rgba(0,245,255,0.3)",    "◈"),
        "warn":    ("#ffd60a", "rgba(255,214,10,0.06)",   "rgba(255,214,10,0.3)",   "⚠"),
        "danger":  ("#ff2244", "rgba(255,34,68,0.06)",    "rgba(255,34,68,0.3)",    "◉"),
        "success": ("#00ff88", "rgba(0,255,136,0.06)",    "rgba(0,255,136,0.3)",    "◆"),
    }
    col, bg, border, icon = cfg.get(variant, cfg["info"])
    return f"""
<div style="
    background: {bg};
    border-left: 3px solid {col};
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin: 14px 0;
    font-family: 'Syne', sans-serif;
    font-size: 0.86rem;
    color: #9ab8d0;
    line-height: 1.6;
    animation: fadeSlideUp 0.3s ease forwards;
    position: relative;
">
  <span style="color:{col}; font-weight:700; margin-right:8px;">{icon}</span>{text}
</div>"""


def section_header(text: str, sub: str = "") -> str:
    sub_html = (
        f'<div style="font-size:0.78rem;color:#3a5070;margin-top:3px;'
        f'font-family:\'Syne\',sans-serif;letter-spacing:0.02em;">{sub}</div>'
    ) if sub else ""
    return f"""
<div style="margin: 32px 0 18px; animation: fadeSlideUp 0.4s ease;">
  <div style="display:flex; align-items:center; gap:10px; padding-bottom:10px;
    border-bottom: 1px solid rgba(0,245,255,0.08);">
    <div style="width:4px; height:16px; background:linear-gradient(180deg,#00f5ff,#7b2fff);
      border-radius:2px;"></div>
    <span style="font-family:'Oxanium',sans-serif; font-size:1.05rem; font-weight:700;
      color:#cce8ff; letter-spacing:0.04em; text-transform:uppercase;">{text}</span>
  </div>
  {sub_html}
</div>"""


def summary_card(points: list) -> str:
    items = "".join(f"""
<li style="
    margin: 8px 0; color: #8aaccc;
    font-family: 'Syne', sans-serif; font-size: 0.87rem; line-height: 1.5;
    display: flex; align-items: flex-start; gap: 8px;
">
  <span style="color:#00f5ff; flex-shrink:0; margin-top:2px;">▸</span>
  <span>{p}</span>
</li>""" for p in points)
    return f"""
<div style="
    background: rgba(0,245,255,0.03);
    border: 1px solid rgba(0,245,255,0.12);
    border-radius: 12px;
    padding: 18px 22px;
    margin: 0 0 24px;
    animation: fadeSlideUp 0.4s ease;
">
  <div style="
    font-family:'Oxanium',sans-serif; font-size:0.65rem; color:#00f5ff;
    text-transform:uppercase; letter-spacing:0.14em; font-weight:700;
    margin-bottom:12px; opacity:0.8;
  ">◈ PAGE INTELLIGENCE</div>
  <ul style="margin:0; padding:0; list-style:none;">{items}</ul>
</div>"""
