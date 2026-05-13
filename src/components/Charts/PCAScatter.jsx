import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useMemo } from 'react'
import { getAttackColor } from '../../utils/colors'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
      <div style={{ color: getAttackColor(d?.label) }}>{d?.label}</div>
      <div style={{ color: '#8aaccc' }}>PC1: {d?.pc1} · PC2: {d?.pc2}</div>
    </div>
  )
}

const RL = ({ payload }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs justify-center" style={{ fontFamily: 'JetBrains Mono,monospace' }}>
    {payload.map((p, i) => (
      <li key={i} className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
        <span style={{ color: '#8aaccc' }}>{p.value}</span>
      </li>
    ))}
  </ul>
)

export default function PCAScatter({ points, classes, varExplained, height = 380 }) {
  const byClass = useMemo(() => {
    const m = {}
    for (const p of points) {
      if (!m[p.label]) m[p.label] = []
      m[p.label].push(p)
    }
    return m
  }, [points])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
        <XAxis
          dataKey="pc1" name="PC1" type="number"
          tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false}
          axisLine={{ stroke: 'rgba(0,245,255,0.1)' }}
          label={{ value: `PC1 (${varExplained?.[0]}% var)`, position: 'insideBottom', offset: -12, fill: '#3a5070', fontSize: 10 }}
        />
        <YAxis
          dataKey="pc2" name="PC2" type="number"
          tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={false}
          label={{ value: `PC2 (${varExplained?.[1]}% var)`, angle: -90, position: 'insideLeft', fill: '#3a5070', fontSize: 10 }}
        />
        <Tooltip content={<TT />} cursor={{ stroke: 'rgba(0,245,255,0.15)' }} />
        <Legend content={<RL />} />
        {classes.map(cls => (
          <Scatter
            key={cls}
            name={cls}
            data={byClass[cls] || []}
            fill={getAttackColor(cls)}
            fillOpacity={0.7}
            r={3}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
