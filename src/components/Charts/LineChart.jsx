import { LineChart as RLChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CHART_COLORS } from '../../utils/colors'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', fontFamily: 'JetBrains Mono,monospace' }}>
      <div style={{ color: '#3a5070' }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</div>)}
    </div>
  )
}

export default function LineChart({ data, lines, xKey, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
        <XAxis dataKey={xKey} tick={{ fill: '#3a5070', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
        <YAxis tick={{ fill: '#3a5070', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={<TT />} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }} />
        {lines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name || l.key}
            stroke={l.color || CHART_COLORS[i]} strokeWidth={2} dot={false} />
        ))}
      </RLChart>
    </ResponsiveContainer>
  )
}
