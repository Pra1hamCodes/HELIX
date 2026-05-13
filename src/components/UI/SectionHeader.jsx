export default function SectionHeader({ title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="accent-bar h-6" />
      <div>
        <div className="font-bold text-base tracking-wide" style={{ color: '#cce8ff', fontFamily: 'Oxanium,sans-serif' }}>{title}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{sub}</div>}
      </div>
    </div>
  )
}
