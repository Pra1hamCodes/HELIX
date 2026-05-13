import { RiGithubFill, RiShieldLine } from 'react-icons/ri'

export default function Footer() {
  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 220, right: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 28px',
      background: 'rgba(2,4,9,0.92)',
      borderTop: '1px solid rgba(0,245,255,0.07)',
      backdropFilter: 'blur(12px)',
      fontFamily: 'JetBrains Mono, monospace',
    }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e2e45', fontSize: '0.65rem' }}>
        <RiShieldLine size={11} />
        <span>HELIX · CICIDS2017 · Network Intrusion Detection Research</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.65rem' }}>
        <span style={{ color: '#1e2e45' }}>Built by</span>
        <a
          href="https://github.com/Pra1hamcodes"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'Oxanium, sans-serif', fontWeight: 700,
            fontSize: '0.7rem', letterSpacing: '0.05em',
            color: '#00f5ff',
            textShadow: '0 0 10px rgba(0,245,255,0.4)',
            textDecoration: 'none', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.textShadow = '0 0 20px rgba(0,245,255,0.8)'}
          onMouseLeave={e => e.currentTarget.style.textShadow = '0 0 10px rgba(0,245,255,0.4)'}
        >
          <RiGithubFill size={13} />
          Pra1ham codes
        </a>
      </div>
    </footer>
  )
}
