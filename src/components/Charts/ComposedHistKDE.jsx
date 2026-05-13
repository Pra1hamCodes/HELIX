import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { histogram, kernelDensity, silvermanBandwidth } from '../../utils/stats'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
      <div style={{ color: '#3a5070' }}>bin: {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</div>
      ))}
    </div>
  )
}

export default function ComposedHistKDE({ values, bins = 30, color = '#00f5ff', height = 260 }) {
  const data = useMemo(() => {
    if (!values?.length) return []
    const hist = histogram(values, bins)
    if (!hist.length) return []

    const bw   = silvermanBandwidth(values)
    const kde  = kernelDensity(values, bw, 150)

    const maxCount = Math.max(...hist.map(h => h.count), 1)
    const maxKDE   = Math.max(...kde.map(k => k.y), 1e-10)
    const scale    = maxCount / maxKDE

    const range = (Math.max(...values) - Math.min(...values)) || 1
    const step  = range / bins

    return hist.map(h => {
      const center = h.bin + step / 2
      // Linear interpolation into KDE curve
      let kdeVal = 0
      for (let i = 0; i < kde.length - 1; i++) {
        if (center >= kde[i].x && center <= kde[i + 1].x) {
          const t = (center - kde[i].x) / (kde[i + 1].x - kde[i].x || 1)
          kdeVal = kde[i].y + t * (kde[i + 1].y - kde[i].y)
          break
        }
      }
      return {
        bin: +h.bin.toFixed(3),
        count: h.count,
        kde: +(kdeVal * scale).toFixed(2),
      }
    })
  }, [values, bins])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
        <XAxis dataKey="bin" tick={{ fill: '#8aaccc', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
        <YAxis tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<TT />} />
        <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }} />
        <Bar dataKey="count" name="Count" fill={color} fillOpacity={0.55} radius={[2, 2, 0, 0]} />
        <Line type="monotone" dataKey="kde" name="KDE" stroke="#ffd60a" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
