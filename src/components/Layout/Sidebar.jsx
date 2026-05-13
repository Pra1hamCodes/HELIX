import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  RiHeartPulseLine, RiBarChartLine, RiAlignLeft,
  RiBugLine, RiTestTubeLine, RiBrainLine,
  RiFileTextLine, RiUpload2Line, RiCalendarLine,
  RiShieldLine, RiLightbulbLine,
} from 'react-icons/ri'
import useDataStore from '../../store/useDataStore'

const NAV = [
  { to: '/health',     icon: RiHeartPulseLine, label: 'Data Health',    color: '#00ff88' },
  { to: '/eda',        icon: RiBarChartLine,   label: 'EDA',            color: '#00f5ff' },
  { to: '/features',   icon: RiAlignLeft,      label: 'Features',       color: '#7b2fff' },
  { to: '/attacks',    icon: RiBugLine,        label: 'Attacks',        color: '#ff2244' },
  { to: '/stats',      icon: RiTestTubeLine,   label: 'Statistics',     color: '#ffd60a' },
  { to: '/ml',         icon: RiBrainLine,      label: 'ML Model',       color: '#00f5ff' },
  { to: '/temporal',   icon: RiCalendarLine,   label: 'Temporal',       color: '#ff9900' },
  { to: '/insights',   icon: RiLightbulbLine,  label: 'Insights',       color: '#ffd60a' },
  { to: '/report',     icon: RiFileTextLine,   label: 'Report',         color: '#00ff88' },
]

export default function Sidebar() {
  const ready    = useDataStore(s => s.ready)
  const reset    = useDataStore(s => s.reset)
  const allRows  = useDataStore(s => s.allRows)
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: 220,
      display: 'flex', flexDirection: 'column', zIndex: 20,
      background: 'rgba(4,8,18,0.97)',
      borderRight: '1px solid rgba(0,245,255,0.08)',
      backdropFilter: 'blur(20px)',
    }}>

      {/* ── Brand ── */}
      <div style={{
        padding: '22px 20px 18px',
        borderBottom: '1px solid rgba(0,245,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {/* Logo icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(0,245,255,0.15), rgba(123,47,255,0.15))',
            border: '1px solid rgba(0,245,255,0.3)',
            boxShadow: '0 0 20px rgba(0,245,255,0.1)',
          }}>
            <RiShieldLine size={18} color="#00f5ff" />
          </div>
          <div>
            <div style={{
              fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700,
              fontSize: '0.95rem', letterSpacing: '0.1em',
              background: 'linear-gradient(135deg, #00f5ff, #cce8ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              HELIX
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
              color: '#2a3a55', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Network Analysis
            </div>
          </div>
        </div>

        {/* Data stats */}
        {ready && (
          <div style={{
            padding: '8px 10px', borderRadius: 8,
            background: 'rgba(0,245,255,0.04)',
            border: '1px solid rgba(0,245,255,0.08)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.62rem', color: '#3a5070',
          }}>
            <div style={{ color: '#00ff88', fontWeight: 600, marginBottom: 2 }}>
              ◉ Dataset loaded
            </div>
            <div>{allRows.length.toLocaleString()} flows analyzed</div>
          </div>
        )}
      </div>

      {/* ── New Upload button ── */}
      <div style={{ padding: '14px 14px 6px' }}>
        <button
          onClick={() => { reset(); navigate('/') }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 14px', borderRadius: 8,
            background: 'rgba(0,245,255,0.06)',
            border: '1px solid rgba(0,245,255,0.2)',
            color: '#00f5ff', cursor: 'pointer',
            fontFamily: 'Oxanium, sans-serif', fontWeight: 600,
            fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,245,255,0.1)'; e.currentTarget.style.boxShadow = '0 0 14px rgba(0,245,255,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,245,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <RiUpload2Line size={14} />
          New Upload
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div style={{
          fontFamily: 'Oxanium, sans-serif', fontSize: '0.6rem',
          letterSpacing: '0.18em', color: '#1e2e45', textTransform: 'uppercase',
          padding: '6px 6px 4px',
        }}>
          Analysis Modules
        </div>

        {NAV.map(({ to, icon: Icon, label, color }) => {
          const isActive  = location.pathname === to
          const isLocked  = !ready

          return (
            <NavLink
              key={to}
              to={to}
              onClick={e => { if (isLocked) e.preventDefault() }}
              title={isLocked ? 'Load data first' : label}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px 9px 12px', borderRadius: 8,
                textDecoration: 'none', transition: 'all 0.18s ease',
                fontFamily: 'Oxanium, sans-serif', fontSize: '0.78rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? color : isLocked ? '#1a2a40' : '#4a5a75',
                background: isActive ? `${color}10` : 'transparent',
                borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
                paddingLeft: isActive ? 10 : 12,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive && !isLocked) {
                  e.currentTarget.style.color = color
                  e.currentTarget.style.background = `${color}08`
                }
              }}
              onMouseLeave={e => {
                if (!isActive && !isLocked) {
                  e.currentTarget.style.color = '#4a5a75'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <Icon size={14} style={{ flexShrink: 0, opacity: isLocked ? 0.25 : 1 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {isActive && (
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: color, boxShadow: `0 0 8px ${color}`,
                  flexShrink: 0,
                }} />
              )}
              {isLocked && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1e2e45', flexShrink: 0 }} />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Status bar ── */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid rgba(0,245,255,0.06)' }}>
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: ready ? 'rgba(0,255,136,0.04)' : 'rgba(0,245,255,0.03)',
          border: `1px solid ${ready ? 'rgba(0,255,136,0.12)' : 'rgba(0,245,255,0.06)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: ready ? 6 : 0 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: ready ? '#00ff88' : '#2a3a55',
              boxShadow: ready ? '0 0 8px #00ff88' : 'none',
              animation: ready ? 'blink 2.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontFamily: 'Oxanium, sans-serif', fontSize: '0.68rem',
              color: ready ? '#00ff88' : '#2a3a55', letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>
              {ready ? 'System Online' : 'Awaiting Data'}
            </span>
          </div>
          {!ready && (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#1a2a40' }}>
              Upload CSV files to begin
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
