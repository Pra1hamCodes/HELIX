import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
      <div style={{ color: '#3a5070' }}>FPR: {payload[0]?.payload?.fpr?.toFixed(3)}</div>
      <div style={{ color: '#00f5ff' }}>TPR: {payload[0]?.payload?.tpr?.toFixed(3)}</div>
    </div>
  )
}

export default function ROCChart({ points, auc, label = 'Model', height = 300 }) {
  // Downsample to ~200 points for rendering performance
  const step    = Math.max(1, Math.floor(points.length / 200))
  const sampled = points.filter((_, i) => i % step === 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs uppercase tracking-widest" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif' }}>AUC</span>
        <span className="text-xl font-bold" style={{ color: auc >= 0.9 ? '#00ff88' : auc >= 0.7 ? '#ffd60a' : '#ff2244', fontFamily: 'Oxanium,sans-serif', textShadow: '0 0 12px currentColor' }}>
          {auc}
        </span>
        <span className="text-xs" style={{ color: '#3a5070' }}>
          {auc >= 0.9 ? '— Excellent' : auc >= 0.8 ? '— Good' : auc >= 0.7 ? '— Fair' : '— Poor'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={sampled} margin={{ top: 4, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
          <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false}
            axisLine={{ stroke: 'rgba(0,245,255,0.1)' }}
            label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -12, fill: '#3a5070', fontSize: 10 }} />
          <YAxis domain={[0, 1]} tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={false}
            label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fill: '#3a5070', fontSize: 10 }} />
          <Tooltip content={<TT />} />
          {/* Random chance diagonal */}
          <Line type="linear" dataKey={() => null} dot={false} stroke="transparent" />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="rgba(58,80,112,0.6)" strokeDasharray="5 5" label={{ value: 'Random', fill: '#3a5070', fontSize: 9, position: 'insideTopLeft' }}
          />
          <Line type="monotone" dataKey="tpr" name={`${label} (AUC=${auc})`}
            stroke="#00f5ff" strokeWidth={2} dot={false}
            style={{ filter: 'drop-shadow(0 0 4px #00f5ff88)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
