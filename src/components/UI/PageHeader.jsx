export default function PageHeader({ icon, title, sub }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        {icon && <span style={{ fontSize: 28 }}>{icon}</span>}
        <h1 className="text-2xl font-bold neon-text" style={{ fontFamily: 'Oxanium,sans-serif' }}>{title}</h1>
      </div>
      {sub && <p className="text-sm ml-1" style={{ color: '#3a5070' }}>{sub}</p>}
      <div className="mt-3 h-px" style={{ background: 'linear-gradient(90deg,#00f5ff33,transparent)' }} />
    </div>
  )
}
