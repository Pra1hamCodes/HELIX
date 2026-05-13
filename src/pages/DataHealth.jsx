import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import MetricCard from '../components/UI/MetricCard'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import { RiHeartPulseLine } from 'react-icons/ri'

function healthScore(files) {
  if (!files.length) return 0
  const allQ = files.flatMap(f => f.quality || [])
  if (!allQ.length) return 0
  const nullPct = allQ.reduce((s, c) => s + c.nullPct, 0) / allQ.length
  const infPct  = allQ.reduce((s, c) => s + (c.infCount > 0 ? 1 : 0), 0) / allQ.length * 100
  return Math.max(0, Math.min(100, 100 - nullPct * 0.5 - infPct * 0.3)).toFixed(1)
}

function QualityTable({ quality }) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="data-table">
        <thead>
          <tr>
            {['Column', 'Type', 'Null%', 'Inf#', 'Unique', 'Min', 'Max', 'Mean'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quality.map((c, i) => (
            <tr key={i}>
              <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{c.column}</td>
              <td><span className="stat-badge">{c.dtype}</span></td>
              <td style={{ color: c.nullPct > 5 ? '#ff2244' : c.nullPct > 0 ? '#ffd60a' : '#00ff88' }}>{c.nullPct}%</td>
              <td style={{ color: c.infCount > 0 ? '#ff2244' : '#3a5070' }}>{c.infCount}</td>
              <td>{c.unique?.toLocaleString()}</td>
              <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{c.min}</td>
              <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{c.max}</td>
              <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{c.mean}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataHealth() {
  const { files, allRows, numCols, labelCounts } = useDataStore()
  const totalRaw  = files.reduce((s, f) => s + (f.rawRows?.length || 0), 0)
  const totalClean = allRows.length
  const retained  = totalRaw ? ((totalClean / totalRaw) * 100).toFixed(1) : '—'
  const score     = healthScore(files)
  const scoreColor = score >= 90 ? '#00ff88' : score >= 75 ? '#ffd60a' : '#ff2244'

  return (
    <div>
      <PageHeader icon="💊" title="Data Health" sub="Quality audit · cleaning stats · column profiles" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Health Score" value={`${score}%`} color={scoreColor} sub="After cleaning" />
        <MetricCard label="Total Files" value={files.length} color="#00f5ff" sub="CSV files loaded" />
        <MetricCard label="Clean Rows" value={totalClean.toLocaleString()} color="#7b2fff" sub={`${retained}% retained`} />
        <MetricCard label="Features" value={numCols.length} color="#ffd60a" sub="Numeric columns" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* File summary */}
        <div className="glass-card p-5">
          <SectionHeader title="File Summary" />
          <div className="space-y-3">
            {files.map((f, i) => {
              const raw   = f.rawRows?.length || 0
              const clean = f.rows?.length || 0
              const pct   = raw ? ((clean / raw) * 100).toFixed(1) : 0
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#cce8ff', fontFamily: 'JetBrains Mono,monospace' }}>{f.name}</span>
                    <span style={{ color: '#3a5070' }}>{clean.toLocaleString()} / {raw.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,245,255,0.1)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#00f5ff,#7b2fff)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Label distribution */}
        <div className="glass-card p-5">
          <SectionHeader title="Label Distribution" sub="Top attack classes" />
          <div className="space-y-2 max-h-64 overflow-auto">
            {labelCounts.slice(0, 15).map((lc, i) => {
              const pct = ((lc.count / totalClean) * 100).toFixed(1)
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate" style={{ color: '#8aaccc', fontFamily: 'JetBrains Mono,monospace' }}>{lc.label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,245,255,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (lc.count / labelCounts[0].count) * 100)}%`, background: lc.label === 'BENIGN' ? '#00ff88' : '#ff2244' }} />
                  </div>
                  <span className="w-14 text-right" style={{ color: '#3a5070' }}>{lc.count.toLocaleString()}</span>
                  <span className="w-10 text-right" style={{ color: '#00f5ff' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quality table per file */}
      {files.map((f, i) => (
        <div key={i} className="glass-card p-5 mb-4">
          <SectionHeader title={`Column Quality — ${f.name}`} sub={`${f.quality?.length || 0} columns`} />
          <QualityTable quality={f.quality || []} />
        </div>
      ))}

      <InsightBox color="#00ff88">
        {totalClean.toLocaleString()} clean rows across {files.length} file(s) · {numCols.length} numeric features · {labelCounts.length} unique classes · {retained}% retention after outlier clipping and deduplication
      </InsightBox>
    </div>
  )
}
