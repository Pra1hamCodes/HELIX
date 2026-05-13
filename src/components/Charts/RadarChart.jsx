import { RadarChart as RRadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { CHART_COLORS } from '../../utils/colors'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', fontFamily: 'JetBrains Mono,monospace' }}>
      <div style={{ color: '#8aaccc' }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</div>)}
    </div>
  )
}

export default function RadarChart({ data, keys, height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RRadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="rgba(0,245,255,0.1)" />
        <PolarAngleAxis dataKey="feature" tick={{ fill: '#8aaccc', fontSize: 9 }} />
        <Tooltip content={<TT />} />
        <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }} />
        {keys.map((k, i) => (
          <Radar key={k} name={k} dataKey={k}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.12} strokeWidth={1.5} />
        ))}
      </RRadarChart>
    </ResponsiveContainer>
  )
}
