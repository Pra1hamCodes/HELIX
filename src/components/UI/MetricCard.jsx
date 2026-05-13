export default function MetricCard({ label, value, sub, color = '#00f5ff', icon }) {
  return (
    <div className="glass-card px-5 py-4 flex flex-col gap-1 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg,${color}33,${color},${color}33)` }} />
      <div className="flex items-center gap-2 mb-1">
        {icon && <span style={{ color, fontSize: 18 }}>{icon}</span>}
        <span className="text-xs uppercase tracking-widest" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color, fontFamily: 'Oxanium,sans-serif', textShadow: `0 0 20px ${color}44` }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: '#3a5070' }}>{sub}</div>}
    </div>
  )
}
