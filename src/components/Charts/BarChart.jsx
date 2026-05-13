import {
  BarChart as RBChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CHART_COLORS } from '../../utils/colors'

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', fontFamily: 'JetBrains Mono,monospace' }}>
      <div style={{ color: '#cce8ff' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</div>
      ))}
    </div>
  )
}

export default function BarChart({ data, xKey, yKey, color, multiColor = false, height = 280, horizontal = false }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
        {horizontal
          ? <>
              <XAxis type="number" tick={{ fill: '#3a5070', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
              <YAxis type="category" dataKey={xKey} tick={{ fill: '#8aaccc', fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
            </>
          : <>
              <XAxis dataKey={xKey} tick={{ fill: '#8aaccc', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
              <YAxis tick={{ fill: '#3a5070', fontSize: 11 }} tickLine={false} axisLine={false} />
            </>
        }
        <Tooltip content={<TT />} />
        <Bar dataKey={yKey} fill={color || CHART_COLORS[0]} radius={[4, 4, 0, 0]}>
          {multiColor && data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </RBChart>
    </ResponsiveContainer>
  )
}
