import { PieChart as RPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '../../utils/colors'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', fontFamily: 'JetBrains Mono,monospace' }}>
      <div style={{ color: d.payload.fill }}>{d.name}</div>
      <div style={{ color: '#cce8ff' }}>{d.value.toLocaleString()} ({((d.payload.pct) || 0).toFixed(1)}%)</div>
    </div>
  )
}

const RL = ({ payload }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs justify-center" style={{ fontFamily: 'JetBrains Mono,monospace' }}>
    {payload.map((p, i) => (
      <li key={i} className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.color }} />
        <span style={{ color: '#8aaccc' }}>{p.value}</span>
      </li>
    ))}
  </ul>
)

export default function PieChart({ data, nameKey = 'label', valueKey = 'count', colors, height = 280, innerRadius = 60 }) {
  const palette = colors || CHART_COLORS
  const total = data.reduce((s, d) => s + d[valueKey], 0)
  const enriched = data.map(d => ({ ...d, pct: (d[valueKey] / total) * 100 }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RPieChart>
        <Pie data={enriched} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="45%"
          innerRadius={innerRadius} outerRadius={innerRadius + 50}
          paddingAngle={2} stroke="none">
          {enriched.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
        </Pie>
        <Tooltip content={<TT />} />
        <Legend content={<RL />} />
      </RPieChart>
    </ResponsiveContainer>
  )
}
