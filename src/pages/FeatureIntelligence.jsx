import { useState, useMemo } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import MetricCard from '../components/UI/MetricCard'
import BarChart from '../components/Charts/BarChart'
import HeatmapChart from '../components/Charts/HeatmapChart'
import PCAScatter from '../components/Charts/PCAScatter'
import { computePCA, computeMutualInfo } from '../utils/ml'

export default function FeatureIntelligence() {
  const { topVarianceFeatures, correlationData, featureStats, numCols, allRows } = useDataStore()
  const [topN, setTopN]       = useState(20)
  const [showPCA, setShowPCA] = useState(false)
  const [showMI, setShowMI]   = useState(false)

  const topFeats = topVarianceFeatures.slice(0, topN)

  const highCorr = useMemo(() => {
    if (!correlationData) return []
    const { cols, matrix } = correlationData
    const pairs = []
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const v = Math.abs(matrix[i][j])
        if (v > 0.9) pairs.push({ a: cols[i], b: cols[j], r: matrix[i][j].toFixed(3), abs: v })
      }
    }
    return pairs.sort((a, b) => b.abs - a.abs).slice(0, 15)
  }, [correlationData])

  // PCA — computed lazily on demand
  const pcaResult = useMemo(() => {
    if (!showPCA || !allRows.length || numCols.length < 2) return null
    const pcaCols = topVarianceFeatures.slice(0, 20).map(f => f.feature).filter(f => numCols.includes(f))
    if (pcaCols.length < 2) return null
    return computePCA(allRows, pcaCols, 2000)
  }, [showPCA, allRows, numCols, topVarianceFeatures])

  // Mutual Information — computed lazily on demand
  const miResult = useMemo(() => {
    if (!showMI || !allRows.length || numCols.length < 2) return null
    return computeMutualInfo(allRows, numCols.slice(0, 40), 'Label', 4000)
  }, [showMI, allRows, numCols])

  const redundantCount = highCorr.length

  return (
    <div>
      <PageHeader icon="🧠" title="Feature Intelligence"
        sub="Variance ranking · Pearson correlation heatmap · redundancy detection · PCA 2D projection" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Features" value={numCols.length} color="#00f5ff" />
        <MetricCard label="Redundant Pairs" value={redundantCount} color={redundantCount > 0 ? '#ff2244' : '#00ff88'}
          sub="|r| > 0.9" />
        <MetricCard label="Top Feature" value={topVarianceFeatures[0]?.feature?.slice(0, 16) || '—'} color="#7b2fff"
          sub={`σ²=${topVarianceFeatures[0]?.variance}`} />
        <MetricCard label="PCA Top-2 Var" value={pcaResult ? `${pcaResult.varExplained[0]}%` : '—'} color="#ffd60a"
          sub={pcaResult ? `+${pcaResult.varExplained[1]}% (PC2)` : 'Run PCA below'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top variance */}
        <div className="glass-card p-5">
          <SectionHeader title="Top Features by Variance" sub={`Top ${topN} of ${numCols.length}`} />
          <div className="mb-4 flex items-center gap-3">
            <label className="text-xs" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif' }}>Top N</label>
            <input type="range" min={5} max={Math.min(numCols.length, 30)} value={topN}
              onChange={e => setTopN(+e.target.value)} className="accent-cyan-400 flex-1" />
            <span className="text-xs" style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace' }}>{topN}</span>
          </div>
          <BarChart
            data={topFeats.map(f => ({ feature: f.feature.slice(0, 24), variance: f.variance }))}
            xKey="feature" yKey="variance" color="#7b2fff"
            horizontal height={Math.max(260, topN * 20)}
          />
        </div>

        {/* High correlation pairs */}
        <div className="glass-card p-5">
          <SectionHeader title="Highly Correlated Pairs" sub="|r| > 0.9 — candidates for removal" />
          {highCorr.length === 0
            ? (
              <div className="flex items-center gap-2 mt-4">
                <span style={{ color: '#00ff88', fontSize: 18 }}>✓</span>
                <span className="text-sm" style={{ color: '#00ff88' }}>No pairs with |r| &gt; 0.9 — no obvious redundancy.</span>
              </div>
            )
            : (
              <div className="space-y-2 max-h-72 overflow-auto">
                {highCorr.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,34,68,0.05)', border: '1px solid rgba(255,34,68,0.12)' }}>
                    <div className="flex-1 min-w-0">
                      <div style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.a}</div>
                      <div style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.b}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm" style={{ color: Math.abs(p.r) > 0.97 ? '#ff2244' : '#ffd60a' }}>r = {p.r}</div>
                      <div style={{ color: '#3a5070', fontSize: 9 }}>{Math.abs(p.r) > 0.97 ? 'near-duplicate' : 'redundant'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* Correlation heatmap */}
      {correlationData && (
        <div className="glass-card p-5 mb-6">
          <SectionHeader title="Pearson Correlation Heatmap" sub="Top 20 features by variance · aligned on finite rows" />
          <HeatmapChart cols={correlationData.cols} matrix={correlationData.matrix} maxCols={20} />
        </div>
      )}

      {/* Mutual Information section */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Mutual Information — Feature ↔ Label" sub="H(Y) − H(Y|X_binned) · discretized into 10 equal-width bins · higher = more informative" />
        {!showMI
          ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">🔗</div>
              <div className="text-sm mb-4" style={{ color: '#3a5070' }}>
                Mutual Information measures how much knowing a feature reduces uncertainty about the attack class.
                Unlike variance, it captures non-linear associations and is not fooled by scaling.
              </div>
              <button onClick={() => setShowMI(true)} className="neon-btn">
                Compute MI Ranking
              </button>
            </div>
          )
          : miResult
            ? (
              <>
                {miResult.every(f => f.mi === 0) && (
                  <div style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(255,214,10,0.05)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: 10, fontFamily: 'JetBrains Mono,monospace', fontSize: '0.72rem', color: '#ffd60a', lineHeight: 1.7 }}>
                    <strong>All MI values are 0.</strong> This happens when all rows share the same Label (e.g. Monday.csv = BENIGN only).<br />
                    Mutual Information requires label diversity. Upload files with attack traffic for meaningful MI scores.
                  </div>
                )}
                <div className="flex items-center gap-4 mb-4 text-xs flex-wrap" style={{ fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }}>
                  <span>Top-{miResult.length} features ranked by MI · <strong style={{ color: '#ffd60a' }}>High MI = strong feature for classification</strong></span>
                </div>
                <BarChart
                  data={miResult.slice(0, 20).map(f => ({ feature: f.feature.slice(0, 26), mi: f.mi }))}
                  xKey="feature" yKey="mi" color="#ffd60a"
                  horizontal height={360}
                />
                <div className="mt-4 overflow-auto max-h-64">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th><th>Feature</th><th>MI (bits)</th><th>Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {miResult.map((f, i) => {
                        const color = f.mi > 0.5 ? '#00ff88' : f.mi > 0.2 ? '#ffd60a' : f.mi > 0.05 ? '#ff9900' : '#3a5070'
                        const label = f.mi > 0.5 ? 'High' : f.mi > 0.2 ? 'Medium' : f.mi > 0.05 ? 'Low' : 'Negligible'
                        return (
                          <tr key={i}>
                            <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#3a5070' }}>{i + 1}</td>
                            <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.feature}</td>
                            <td style={{ color, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 600 }}>{f.mi}</td>
                            <td><span className="stat-badge" style={{ color, borderColor: color + '44', background: color + '11', fontSize: 10 }}>{label}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
            : <div className="text-sm text-center py-4" style={{ color: '#ff2244' }}>MI failed — need data.</div>
        }
      </div>

      {/* PCA section */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="PCA — 2D Projection" sub="Power-iteration on covariance of top-20 variance features · colored by class" />
        {!showPCA
          ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">🔬</div>
              <div className="text-sm mb-4" style={{ color: '#3a5070' }}>
                Principal Component Analysis projects high-dimensional feature space to 2D, revealing cluster structure per attack class.
              </div>
              <button onClick={() => setShowPCA(true)} className="neon-btn">
                Compute PCA
              </button>
            </div>
          )
          : pcaResult
            ? (
              <>
                <div className="flex items-center gap-6 mb-4 text-xs" style={{ fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }}>
                  <span>PC1 explained variance: <strong style={{ color: '#00f5ff' }}>{pcaResult.varExplained[0]}%</strong></span>
                  <span>PC2 explained variance: <strong style={{ color: '#7b2fff' }}>{pcaResult.varExplained[1]}%</strong></span>
                  <span>Total: <strong style={{ color: '#00ff88' }}>{(pcaResult.varExplained[0] + pcaResult.varExplained[1]).toFixed(1)}%</strong></span>
                  <span>{pcaResult.points.length} points plotted (max 100 per class)</span>
                </div>
                <PCAScatter
                  points={pcaResult.points}
                  classes={pcaResult.classes}
                  varExplained={pcaResult.varExplained}
                  height={400}
                />
              </>
            )
            : <div className="text-sm text-center py-4" style={{ color: '#ff2244' }}>PCA failed — need at least 2 numeric features.</div>
        }
      </div>

      {/* Feature stats table — full with percentiles */}
      <div className="glass-card p-5 mb-4">
        <SectionHeader title="Feature Statistics" sub={`All ${featureStats.length} numeric features`} />
        <div className="overflow-auto max-h-72">
          <table className="data-table">
            <thead>
              <tr>{['Feature', 'Mean', 'Median', 'Std', 'Variance', 'P25', 'P75', 'P95', 'Skew', 'Kurt'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {featureStats.map((f, i) => (
                <tr key={i}>
                  <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.feature}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.mean}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#7b2fff' }}>{f.median}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.std}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.variance}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#8aaccc' }}>{f.p25}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#8aaccc' }}>{f.p75}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#8aaccc' }}>{f.p95}</td>
                  <td style={{ color: Math.abs(f.skewness) > 2 ? '#ffd60a' : '#8aaccc', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.skewness}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.kurtosis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InsightBox color="#7b2fff">
        {redundantCount} feature pairs with |r| &gt; 0.9 detected — consider dropping one from each pair before training.
        Top variance feature: <strong>{topVarianceFeatures[0]?.feature}</strong> (σ²={topVarianceFeatures[0]?.variance}).
        Use PCA to visually validate class separability before choosing a classifier.
      </InsightBox>
    </div>
  )
}
