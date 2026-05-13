import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ErrorBar, Cell,
} from 'recharts'
import { getAttackColor } from '../../utils/colors'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
      <div style={{ color: getAttackColor(d?.cls) }}>{d?.cls}</div>
      <div style={{ color: '#cce8ff' }}>Mean: {d?.mean?.toFixed(4)}</div>
      <div style={{ color: '#8aaccc' }}>±Std: {d?.std?.toFixed(4)}</div>
      <div style={{ color: '#3a5070' }}>P25–P75: {d?.p25?.toFixed(3)} – {d?.p75?.toFixed(3)}</div>
      <div style={{ color: '#3a5070' }}>Median: {d?.median?.toFixed(4)}</div>
    </div>
  )
}

export default function ClassMeanChart({ data, height = 300 }) {
  // data = [{ cls, mean, std, median, p25, p75 }]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
        <XAxis type="number" tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
        <YAxis type="category" dataKey="cls" tick={{ fill: '#8aaccc', fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
        <Tooltip content={<TT />} />
        <Bar dataKey="mean" name="Mean" radius={[0, 4, 4, 0]}>
          <ErrorBar dataKey="std" direction="x" stroke="rgba(255,214,10,0.7)" strokeWidth={1.5} />
          {data.map((d, i) => (
            <Cell key={i} fill={getAttackColor(d.cls)} fillOpacity={0.75} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
