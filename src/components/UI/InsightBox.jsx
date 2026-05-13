export default function InsightBox({ children, color = '#00f5ff' }) {
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{
      background: `${color}08`,
      border: `1px solid ${color}22`,
      color: '#8aaccc',
      fontFamily: 'JetBrains Mono,monospace',
    }}>
      <span style={{ color }} className="font-semibold mr-2">//</span>
      {children}
    </div>
  )
}
