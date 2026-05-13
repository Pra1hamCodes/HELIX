import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', fontFamily: 'JetBrains Mono,monospace' }}>
      {payload.map((p, i) => <div key={i} style={{ color: '#cce8ff' }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</div>)}
    </div>
  )
}

export default function ScatterPlot({ data, xKey, yKey, color = '#00f5ff', height = 280, xLabel, yLabel }) {
  const mapped = data.map(r => ({ x: +r[xKey], y: +r[yKey] }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 4, right: 16, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
        <XAxis dataKey="x" name={xLabel || xKey} tick={{ fill: '#3a5070', fontSize: 10 }} label={{ value: xLabel || xKey, position: 'insideBottom', offset: -10, fill: '#3a5070', fontSize: 10 }} />
        <YAxis dataKey="y" name={yLabel || yKey} tick={{ fill: '#3a5070', fontSize: 10 }} />
        <Tooltip content={<TT />} cursor={{ stroke: 'rgba(0,245,255,0.2)' }} />
        <Scatter data={mapped} fill={color} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
