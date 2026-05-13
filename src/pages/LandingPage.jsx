import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useDataStore from '../store/useDataStore'
import {
  parseCSVFile, cleanRows, computeQuality,
  computeFeatureStats, getLabelCounts,
  topFeaturesByVariance, computeCorrelationMatrix, computeAttackProfiles,
} from '../utils/dataProcessor'

// ── Radar canvas background ──────────────────────────────────────
function RadarCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let angle = 0
    let animId

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Blip data — random threat positions
    const blips = Array.from({ length: 8 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist:  0.2 + Math.random() * 0.75,
      alpha: 0,
    }))

    const draw = () => {
      const W = canvas.width, H = canvas.height
      const cx = W / 2, cy = H / 2
      const R  = Math.min(W, H) * 0.46

      ctx.clearRect(0, 0, W, H)

      // Concentric rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,245,255,${0.04 + i * 0.02})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // Cross-hairs
      ctx.strokeStyle = 'rgba(0,245,255,0.06)'
      ctx.lineWidth = 0.6
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()
      // Diagonals
      ctx.strokeStyle = 'rgba(0,245,255,0.03)'
      const d = R * 0.707
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke()

      // Sweep trail (comet tail)
      const trailArc = Math.PI * 0.55
      for (let t = 0; t < 40; t++) {
        const a  = angle - (trailArc * t / 40)
        const op = (1 - t / 40) * 0.18
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, a - 0.04, a)
        ctx.closePath()
        ctx.fillStyle = `rgba(0,245,255,${op})`
        ctx.fill()
      }

      // Sweep line
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R)
      ctx.strokeStyle = 'rgba(0,245,255,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Blips — light up as sweep passes
      blips.forEach(b => {
        const diff = ((angle - b.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        if (diff < 0.15) b.alpha = 1
        else b.alpha = Math.max(0, b.alpha - 0.008)

        if (b.alpha > 0) {
          const bx = cx + Math.cos(b.angle) * R * b.dist
          const by = cy + Math.sin(b.angle) * R * b.dist
          ctx.beginPath()
          ctx.arc(bx, by, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,34,68,${b.alpha * 0.9})`
          ctx.fill()
          ctx.beginPath()
          ctx.arc(bx, by, 7, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,34,68,${b.alpha * 0.3})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })

      angle += 0.018
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      opacity: 0.65, pointerEvents: 'none',
    }} />
  )
}

// ── Hex grid background ──────────────────────────────────────────
function HexGrid() {
  return (
    <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', opacity: 0.025, pointerEvents: 'none', zIndex: 0 }}>
      <defs>
        <pattern id="hex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon points="28,2 52,14 52,38 28,50 4,38 4,14"
            fill="none" stroke="#00f5ff" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  )
}

// ── Processing pipeline steps ────────────────────────────────────
const PIPELINE = [
  { key: 'parse',       label: 'Parsing CSV files',       icon: '📂' },
  { key: 'clean',       label: 'Cleaning & normalizing',   icon: '🧹' },
  { key: 'stats',       label: 'Computing statistics',     icon: '📊' },
  { key: 'variance',    label: 'Feature intelligence',     icon: '🧠' },
  { key: 'correlation', label: 'Correlation analysis',     icon: '🔗' },
  { key: 'profiles',    label: 'Attack profiling',         icon: '🎯' },
]

function stepIndexFromMsg(msg) {
  if (!msg) return -1
  const m = msg.toLowerCase()
  if (m.includes('parsing') || m.includes('parse')) return 0
  if (m.includes('clean'))   return 1
  if (m.includes('statistic') || m.includes('label')) return 2
  if (m.includes('variance') || m.includes('feature')) return 3
  if (m.includes('correlation')) return 4
  if (m.includes('attack') || m.includes('profil')) return 5
  return 0
}

function ProcessingScreen({ msg }) {
  const step = stepIndexFromMsg(msg)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#020409',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, flexDirection: 'column',
    }}>
      <HexGrid />

      {/* Radar */}
      <div style={{
        position: 'absolute', right: '5vw', top: '50%', transform: 'translateY(-50%)',
        width: 320, height: 320, opacity: 0.5,
      }}>
        <RadarCanvas />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, padding: '0 32px' }}>
        {/* Title */}
        <div style={{ marginBottom: 48, animation: 'float-up 0.5s ease both' }}>
          <div style={{
            fontFamily: 'Chakra Petch, sans-serif', fontSize: '0.65rem',
            letterSpacing: '0.3em', color: '#ff2244', marginBottom: 8,
            textTransform: 'uppercase',
          }}>
            ◉ THREAT ANALYSIS IN PROGRESS
          </div>
          <div className="ns-hero-title" style={{ fontSize: '2rem', marginBottom: 4 }}>
            HELIX
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
            color: '#3a5070', letterSpacing: '0.1em',
          }}>
            {msg || 'Initializing…'}
            <span style={{ animation: 'blink 1s step-end infinite', marginLeft: 2, color: '#00f5ff' }}>█</span>
          </div>
        </div>

        {/* Pipeline steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PIPELINE.map((s, i) => {
            const done    = i < step
            const active  = i === step
            const pending = i > step
            return (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 18px', borderRadius: 10,
                background: active  ? 'rgba(0,245,255,0.08)' :
                            done    ? 'rgba(0,255,136,0.05)' :
                                      'rgba(8,15,30,0.5)',
                border: `1px solid ${active ? 'rgba(0,245,255,0.35)' : done ? 'rgba(0,255,136,0.2)' : 'rgba(0,245,255,0.06)'}`,
                transition: 'all 0.4s ease',
                animation: `float-up 0.5s ease ${i * 0.07}s both`,
              }}>
                {/* Indicator */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active  ? 'rgba(0,245,255,0.15)' :
                              done    ? 'rgba(0,255,136,0.15)' :
                                        'rgba(0,245,255,0.04)',
                  border: `1.5px solid ${active ? '#00f5ff' : done ? '#00ff88' : 'rgba(0,245,255,0.12)'}`,
                  boxShadow: active ? '0 0 12px rgba(0,245,255,0.4)' : done ? '0 0 8px rgba(0,255,136,0.3)' : 'none',
                  ...(active ? { animation: 'step-pulse 1.2s ease infinite' } : {}),
                  fontSize: 12,
                }}>
                  {done ? '✓' : active ? '◉' : <span style={{ opacity: 0.3 }}>{i + 1}</span>}
                </div>

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'Oxanium, sans-serif',
                    fontSize: '0.78rem',
                    color: active ? '#00f5ff' : done ? '#00ff88' : '#2a3a55',
                    fontWeight: active || done ? 600 : 400,
                    letterSpacing: '0.05em',
                  }}>
                    {s.label}
                  </div>
                  {active && (
                    <div style={{ marginTop: 5, height: 2, borderRadius: 1, background: 'rgba(0,245,255,0.1)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 1,
                        background: 'linear-gradient(90deg, #00f5ff, #7b2fff)',
                        animation: 'progress-fill 2s ease-in-out infinite alternate',
                      }} />
                    </div>
                  )}
                </div>

                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
                  color: active ? '#00f5ff' : done ? '#00ff88' : '#1a2a40',
                }}>
                  {done ? 'DONE' : active ? 'RUNNING' : 'WAIT'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Landing Page ────────────────────────────────────────────
export default function LandingPage() {
  const [dragging, setDragging]   = useState(false)
  const [pending, setPending]     = useState([])
  const [hovered, setHovered]     = useState(false)
  const { loading, loadingMsg, setLoading, setProcessed, setError, error } = useDataStore()
  const navigate = useNavigate()

  const handleFiles = useCallback((files) => {
    const csvs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.csv'))
    if (!csvs.length) return
    setPending(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...csvs.filter(f => !existing.has(f.name))]
    })
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removeFile = (name) => setPending(prev => prev.filter(f => f.name !== name))

  const process = async () => {
    if (!pending.length) return
    setLoading(true, 'Parsing CSV files…')

    try {
      const fileResults = []
      const allRaw = []

      for (let i = 0; i < pending.length; i++) {
        const file = pending[i]
        setLoading(true, `Parsing ${file.name} (${i + 1}/${pending.length})…`)
        const rawRows = await parseCSVFile(file)
        const quality = computeQuality(rawRows, file.name)
        const { rows, numCols, clipBounds } = cleanRows(rawRows)
        fileResults.push({ name: file.name, rawRows, rows, numCols, clipBounds, quality })
        allRaw.push(...rows)
      }

      setLoading(true, 'Cleaning & normalizing data…')
      const allRows = allRaw
      const numCols = fileResults[0]?.numCols || []

      setLoading(true, 'Computing statistics…')
      const featureStats = computeFeatureStats(allRows, numCols)
      const labelCounts  = getLabelCounts(allRows)

      setLoading(true, 'Computing variance rankings…')
      const topVarianceFeatures = topFeaturesByVariance(allRows, numCols, 20)

      setLoading(true, 'Computing correlation matrix…')
      const correlationData = computeCorrelationMatrix(allRows, numCols, 20, 5000)

      setLoading(true, 'Attack profiling…')
      const attackProfiles = computeAttackProfiles(allRows, numCols)

      setProcessed({ files: fileResults, allRows, numCols, featureStats, labelCounts, topVarianceFeatures, correlationData, attackProfiles })
      navigate('/health')
    } catch (err) {
      setError(err.message || 'Processing failed')
    }
  }

  if (loading) return <ProcessingScreen msg={loadingMsg} />

  const FEATURES = [
    { n: '9',     label: 'Analysis Modules',    icon: '⬡' },
    { n: '100%',  label: 'In-Browser',           icon: '🔒' },
    { n: '15',    label: 'Attack Classes',       icon: '⚠' },
    { n: '78+',   label: 'Network Features',     icon: '◈' },
  ]

  const MODULES = [
    'Data Health', 'EDA', 'Feature Intelligence', 'Attack Patterns',
    'Statistical Testing', 'ML Modeling', 'Temporal Analysis', 'Analyst Report',
  ]

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <HexGrid />

      {/* Ambient glow orbs */}
      <div style={{ position: 'fixed', top: '15%', right: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '5%',  width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,47,255,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Radar — right side */}
      <div style={{
        position: 'fixed', right: '-60px', top: '50%', transform: 'translateY(-50%)',
        width: 440, height: 440, opacity: 0.55, zIndex: 0,
      }}>
        <RadarCanvas />
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 680, padding: '40px 32px' }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom: 52, animation: 'float-up 0.7s ease both' }}>
          {/* Status tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 20,
            border: '1px solid rgba(255,34,68,0.3)',
            background: 'rgba(255,34,68,0.06)',
            marginBottom: 20, fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.65rem', letterSpacing: '0.15em', color: '#ff6688',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#ff2244',
              boxShadow: '0 0 8px #ff2244', display: 'inline-block',
              animation: 'blink 1.8s ease-in-out infinite',
            }} />
            HELIX · CICIDS2017 THREAT INTELLIGENCE PLATFORM
          </div>

          {/* Title */}
          <h1 className="ns-hero-title" style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)', lineHeight: 1.0, marginBottom: 12 }}>
            HELIX
          </h1>

          {/* Subtitle */}
          <p style={{
            fontFamily: 'Chakra Petch, sans-serif',
            fontSize: '0.85rem', letterSpacing: '0.12em',
            color: '#4a6a8a', marginBottom: 20,
            textTransform: 'uppercase',
          }}>
            Network Intrusion Detection &amp; Threat Intelligence
          </p>

          {/* Module chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MODULES.map((m, i) => (
              <span key={m} className="ns-tag" style={{ animationDelay: `${0.5 + i * 0.05}s`, animation: 'fade-in 0.4s ease both' }}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* ── Upload zone ── */}
        <div
          className={`ns-upload-zone${dragging ? ' dragging' : ''}`}
          style={{ padding: '40px 32px', textAlign: 'center', cursor: 'pointer', marginBottom: 20 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('ns-file-input').click()}
        >
          <input id="ns-file-input" type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

          {/* Scan line — shows when hovering or dragging */}
          {(hovered || dragging) && <div className="ns-scan-line" />}

          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 12, margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dragging ? 'rgba(0,245,255,0.12)' : 'rgba(0,245,255,0.06)',
            border: `1.5px solid ${dragging ? '#00f5ff' : 'rgba(0,245,255,0.2)'}`,
            fontSize: 28, transition: 'all 0.3s ease',
            boxShadow: dragging ? '0 0 24px rgba(0,245,255,0.3)' : 'none',
          }}>
            {dragging ? '⬇' : '📁'}
          </div>

          <div style={{
            fontFamily: 'Chakra Petch, sans-serif', fontWeight: 600,
            fontSize: '1.1rem', letterSpacing: '0.1em',
            color: dragging ? '#00f5ff' : '#cce8ff',
            marginBottom: 8, transition: 'color 0.3s',
          }}>
            {dragging ? 'RELEASE TO LOAD FILES' : 'DROP CICIDS CSV FILES HERE'}
          </div>

          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem',
            color: '#2a3a55', letterSpacing: '0.06em',
          }}>
            or click to browse · .csv files only · multiple files supported
          </div>

          <div style={{
            marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#1e2e45',
          }}>
            {['Monday.csv', 'Tuesday.csv', 'Friday.csv', '…'].map(f => (
              <span key={f} style={{ padding: '2px 8px', border: '1px solid rgba(0,245,255,0.08)', borderRadius: 4 }}>{f}</span>
            ))}
          </div>
        </div>

        {/* ── File list ── */}
        {pending.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {pending.map((f, i) => (
              <div key={f.name} className="ns-file-item" style={{
                animationDelay: `${i * 0.06}s`,
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px', borderRadius: 10,
                background: 'rgba(0,245,255,0.04)',
                border: '1px solid rgba(0,245,255,0.12)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>📄</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
                    color: '#00f5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{f.name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#2a3a55', marginTop: 2 }}>
                    {(f.size / 1024 / 1024).toFixed(2)} MB · CSV
                  </div>
                </div>

                <div style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: '0.62rem',
                  fontFamily: 'Oxanium, sans-serif', letterSpacing: '0.1em',
                  background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)',
                  color: '#00ff88',
                }}>READY</div>

                <button onClick={(e) => { e.stopPropagation(); removeFile(f.name) }} style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,34,68,0.2)',
                  background: 'rgba(255,34,68,0.06)', color: '#ff4466', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,34,68,0.15)'; e.currentTarget.style.borderColor = '#ff2244' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,34,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,34,68,0.2)' }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 20, padding: '12px 18px', borderRadius: 10,
            background: 'rgba(255,34,68,0.06)', border: '1px solid rgba(255,34,68,0.25)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#ff2244',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Launch button ── */}
        <div style={{ animation: 'float-up 0.8s ease 0.4s both' }}>
          <button
            className="ns-launch-btn"
            onClick={process}
            disabled={!pending.length}
            style={{ width: '100%' }}
          >
            {pending.length === 0
              ? '— LOAD FILES TO CONTINUE —'
              : `⬡ INITIALIZE ANALYSIS  ·  ${pending.length} FILE${pending.length > 1 ? 'S' : ''}`}
          </button>
        </div>

        {/* ── Stats row ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          marginTop: 32, animation: 'float-up 0.8s ease 0.6s both',
        }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{
              padding: '16px 12px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(8,15,30,0.6)',
              border: '1px solid rgba(0,245,255,0.08)',
              transition: 'all 0.25s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.3)'; e.currentTarget.style.background = 'rgba(0,245,255,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.08)'; e.currentTarget.style.background = 'rgba(8,15,30,0.6)' }}
            >
              <div style={{ fontSize: 18, marginBottom: 6 }}>{f.icon}</div>
              <div style={{
                fontFamily: 'Chakra Petch, sans-serif', fontSize: '1.5rem',
                fontWeight: 700, color: '#00f5ff', lineHeight: 1,
                textShadow: '0 0 16px rgba(0,245,255,0.5)', marginBottom: 4,
              }}>{f.n}</div>
              <div style={{
                fontFamily: 'Oxanium, sans-serif', fontSize: '0.62rem',
                color: '#2a3a55', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>{f.label}</div>
            </div>
          ))}
        </div>

        {/* Footer credit */}
        <div style={{
          marginTop: 36, textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
          color: '#1a2a40', animation: 'fade-in 1s ease 1s both',
        }}>
          Built by{' '}
          <a href="https://github.com/Pra1hamcodes" target="_blank" rel="noopener noreferrer"
            style={{ color: '#3a5070', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#00f5ff'}
            onMouseLeave={e => e.currentTarget.style.color = '#3a5070'}
          >Pra1ham codes</a>
          {' '}· All analysis runs in your browser · No data leaves your device
        </div>
      </div>
    </div>
  )
}
