import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
      <div style={{ color: '#3a5070' }}>Recall: {payload[0]?.payload?.recall?.toFixed(3)}</div>
      <div style={{ color: '#00ff88' }}>Precision: {payload[0]?.payload?.precision?.toFixed(3)}</div>
    </div>
  )
}

export default function PRChart({ points, ap, prevalence, label = 'Model', height = 300 }) {
  const step    = Math.max(1, Math.floor(points.length / 300))
  const sampled = points.filter((_, i) => i % step === 0)

  const apColor = ap >= 0.9 ? '#00ff88' : ap >= 0.7 ? '#ffd60a' : '#ff2244'

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif' }}>AP</span>
          <span className="text-xl font-bold" style={{ color: apColor, fontFamily: 'Oxanium,sans-serif', textShadow: `0 0 12px ${apColor}` }}>
            {ap}
          </span>
        </div>
        <div className="text-xs" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
          Baseline (random) = <span style={{ color: '#ff9900' }}>{prevalence}</span>
          {' · '}gain = <span style={{ color: apColor }}>{+(ap - prevalence).toFixed(4)}</span>
        </div>
        <div className="text-xs" style={{ color: '#3a5070' }}>
          {ap >= 0.9 ? '— Excellent' : ap >= 0.8 ? '— Good' : ap >= 0.7 ? '— Fair' : '— Poor'}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={sampled} margin={{ top: 4, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
          <XAxis dataKey="recall" type="number" domain={[0, 1]}
            tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false}
            axisLine={{ stroke: 'rgba(0,245,255,0.1)' }}
            label={{ value: 'Recall', position: 'insideBottom', offset: -12, fill: '#3a5070', fontSize: 10 }} />
          <YAxis domain={[0, 1]}
            tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={false}
            label={{ value: 'Precision', angle: -90, position: 'insideLeft', fill: '#3a5070', fontSize: 10 }} />
          <Tooltip content={<TT />} />
          {/* Random baseline = class prevalence */}
          <ReferenceLine y={prevalence} stroke="rgba(255,153,0,0.5)" strokeDasharray="5 5"
            label={{ value: `baseline=${prevalence}`, fill: '#ff9900', fontSize: 9, position: 'insideTopRight' }} />
          <Line type="monotone" dataKey="precision" name={`${label} (AP=${ap})`}
            stroke="#00ff88" strokeWidth={2} dot={false}
            style={{ filter: 'drop-shadow(0 0 4px #00ff8888)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
