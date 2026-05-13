import { useMemo, useEffect } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import MetricCard from '../components/UI/MetricCard'
import BarChart from '../components/Charts/BarChart'
import { mean, std, variance } from '../utils/stats'
import { tDistCDF, bhFDR } from '../utils/ml'

// ── Normal CDF (Hart approximation — used only for MW normal approx) ──────
function normalCDF(z) {
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429]
  const p = 0.3275911
  const sign = z < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(z))
  const y = 1 - (((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t) * Math.exp(-z * z / 2)
  return 0.5 * (1 + sign * y)
}

// ── Mann-Whitney U  (rank-based, tie-corrected, normal approx) ────────────
function mannWhitneyU(x, y) {
  const nx = x.length, ny = y.length
  if (!nx || !ny) return { u: 0, z: 0, p: 1, r: 0 }

  const combined = [
    ...x.map(v => ({ v, g: 0 })),
    ...y.map(v => ({ v, g: 1 })),
  ].sort((a, b) => a.v - b.v)

  // Average ranks with tie correction
  const ranks = new Array(combined.length)
  let tieCorr = 0, i = 0
  while (i < combined.length) {
    let j = i
    while (j < combined.length && combined[j].v === combined[i].v) j++
    const avgRank = (i + j + 1) / 2
    for (let k = i; k < j; k++) ranks[k] = avgRank
    const t = j - i
    if (t > 1) tieCorr += t ** 3 - t
    i = j
  }

  const Rx  = combined.reduce((s, c, idx) => s + (c.g === 0 ? ranks[idx] : 0), 0)
  const U   = Rx - (nx * (nx + 1)) / 2
  const mu  = (nx * ny) / 2
  const N   = nx + ny
  const sig = Math.sqrt((nx * ny / 12) * (N + 1 - tieCorr / (N * (N - 1)))) || 1
  const z   = (U - mu) / sig
  const p   = 2 * (1 - normalCDF(Math.abs(z)))
  const r   = +(1 - (2 * U) / (nx * ny)).toFixed(4)   // Kerby rank-biserial

  return { u: +U.toFixed(2), z: +z.toFixed(4), p: +Math.min(1, Math.max(0, p)).toFixed(4), r }
}

// ── Welch's t-test  (exact t-distribution CDF) ────────────────────────────
function welchT(x, y) {
  const nx = x.length, ny = y.length
  if (nx < 2 || ny < 2) return { t: 0, df: 0, p: 1 }
  const mx = mean(x), my = mean(y)
  const vx = variance(x) / nx, vy = variance(y) / ny
  const se = Math.sqrt(vx + vy) || 1e-12
  const t  = (mx - my) / se
  const df = Math.max(1, Math.round((vx + vy) ** 2 / (vx ** 2 / (nx - 1) + vy ** 2 / (ny - 1))))
  const p  = 2 * (1 - tDistCDF(Math.abs(t), df))   // exact t-distribution CDF
  return { t: +t.toFixed(4), df, p: +Math.min(1, Math.max(0, p)).toFixed(4) }
}

// ── Cohen's d (pooled SD) ─────────────────────────────────────────────────
function cohensD(x, y) {
  const pooled = Math.sqrt((variance(x) + variance(y)) / 2) || 1
  return +((mean(x) - mean(y)) / pooled).toFixed(4)
}

// ── Bootstrap 95% CI for Cohen's d (B resamples) ─────────────────────────
function bootstrapCI(bVals, mVals, B = 500) {
  const n1 = bVals.length, n2 = mVals.length
  const dists = []
  for (let b = 0; b < B; b++) {
    const s1 = Array.from({ length: n1 }, () => bVals[Math.floor(Math.random() * n1)])
    const s2 = Array.from({ length: n2 }, () => mVals[Math.floor(Math.random() * n2)])
    dists.push(cohensD(s1, s2))
  }
  dists.sort((a, b) => a - b)
  return {
    lo: +dists[Math.floor(B * 0.025)].toFixed(3),
    hi: +dists[Math.floor(B * 0.975)].toFixed(3),
  }
}

function effectLabel(d) {
  const a = Math.abs(d)
  if (a < 0.2) return { label: 'Negligible', color: '#3a5070' }
  if (a < 0.5) return { label: 'Small',      color: '#ffd60a' }
  if (a < 0.8) return { label: 'Medium',     color: '#ff9900' }
  return              { label: 'Large',      color: '#ff2244' }
}

function rbisLabel(r) {
  const a = Math.abs(r)
  if (a < 0.1) return 'Negligible'
  if (a < 0.3) return 'Small'
  if (a < 0.5) return 'Medium'
  return 'Large'
}

const SAMPLE = 500   // per class — MW is O(n²), 500×500=250K comparisons

export default function StatisticalTesting() {
  const { allRows, numCols, setStatSummary } = useDataStore()

  const { results, qValues } = useMemo(() => {
    if (!allRows.length || numCols.length < 2) return { results: [], qValues: [] }

    const benign    = allRows.filter(r => r['Label'] === 'BENIGN').slice(0, SAMPLE)
    const malicious = allRows.filter(r => r['Label'] !== 'BENIGN').slice(0, SAMPLE)

    const raw = numCols.slice(0, 40).map(col => {
      const bVals = benign.map(r => +r[col]).filter(isFinite)
      const mVals = malicious.map(r => +r[col]).filter(isFinite)
      if (bVals.length < 5 || mVals.length < 5) return null

      const d   = cohensD(bVals, mVals)
      const eff = effectLabel(d)
      const mw  = mannWhitneyU(bVals, mVals)
      const wt  = welchT(bVals, mVals)
      const ci  = bootstrapCI(bVals, mVals, 500)

      return {
        feature:       col,
        benignMean:    +mean(bVals).toFixed(4),
        maliciousMean: +mean(mVals).toFixed(4),
        cohensD:       d,
        ciLo:          ci.lo,
        ciHi:          ci.hi,
        effectSize:    eff.label,
        effectColor:   eff.color,
        mwZ:           mw.z,
        mwP:           mw.p,
        mwR:           mw.r,
        mwRLabel:      rbisLabel(mw.r),
        wtT:           wt.t,
        wtDf:          wt.df,
        wtP:           wt.p,
        rawSig:        mw.p < 0.05 && wt.p < 0.05,
      }
    }).filter(Boolean)

    // Use MW p-value for BH correction (it's the more conservative non-parametric test)
    const pVec  = raw.map(r => r.mwP)
    const qVec  = bhFDR(pVec)

    const results = raw.map((r, i) => ({
      ...r,
      qValue:   qVec[i],
      bhSig:    qVec[i] < 0.05,
    })).sort((a, b) => Math.abs(b.cohensD) - Math.abs(a.cohensD))

    return { results, qValues: qVec }
  }, [allRows, numCols])

  const rawSig    = results.filter(r => r.rawSig).length
  const bhSig     = results.filter(r => r.bhSig).length
  const falseDisc = rawSig - bhSig
  const large     = results.filter(r => r.effectSize === 'Large').length

  // Save summary to store for the report generator
  useEffect(() => {
    if (results.length > 0) {
      setStatSummary({
        total: results.length,
        bhSig, rawSig, falseDisc,
        topFeatures: results.slice(0, 10).map(r => ({
          feature: r.feature, cohensD: r.cohensD, qValue: r.qValue,
          effectSize: r.effectSize, ciLo: r.ciLo, ciHi: r.ciHi,
        })),
      })
    }
  }, [results, bhSig, rawSig, falseDisc])  // eslint-disable-line

  const topEffects = results.slice(0, 15).map(r => ({
    feature: r.feature.slice(0, 26),
    effect:  +Math.abs(r.cohensD).toFixed(4),
  }))

  const downloadCSV = () => {
    const cols = ['feature','benignMean','maliciousMean','cohensD','ciLo','ciHi','effectSize','mwZ','mwP','mwR','mwRLabel','wtT','wtDf','wtP','qValue','bhSig']
    const rows = [cols.join(','), ...results.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'stat-testing-results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const maliciousCount = allRows.filter(r => r['Label'] !== 'BENIGN').length
  const isBenignOnly = maliciousCount === 0

  if (isBenignOnly) return (
    <div>
      <PageHeader icon="🧪" title="Statistical Testing" sub="Benign vs Malicious · Mann-Whitney U · Welch t · Cohen's d · BH-FDR" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>📊</div>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: '1.3rem', fontWeight: 700, color: '#ffd60a' }}>No Comparison Possible</div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.8rem', color: '#4a6080', maxWidth: 520, lineHeight: 1.8 }}>
          Statistical testing compares <span style={{ color: '#00ff88' }}>BENIGN</span> vs <span style={{ color: '#ff2244' }}>MALICIOUS</span> feature distributions.<br />
          Your dataset has no malicious rows to compare against.
        </div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.72rem', color: '#2a4060', maxWidth: 480, lineHeight: 1.8, padding: '14px 20px', background: 'rgba(255,214,10,0.04)', border: '1px solid rgba(255,214,10,0.12)', borderRadius: 12 }}>
          <div style={{ color: '#ff9900', marginBottom: 8, fontWeight: 700 }}>Requires attack-labeled samples:</div>
          Tuesday.csv · Wednesday.csv · Thursday.csv · Friday.csv
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader icon="🧪" title="Statistical Testing"
        sub={`Benign vs Malicious · Mann-Whitney U + Welch's t (exact t-CDF) · Cohen's d · BH-FDR correction · n=${SAMPLE}/class`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Features Tested"     value={results.length}  color="#00f5ff" />
        <MetricCard label="Raw Sig. (p<0.05)"  value={rawSig}           color="#ffd60a" sub="Before correction" />
        <MetricCard label="BH-FDR Sig. (q<0.05)" value={bhSig}          color="#00ff88" sub="After FDR correction" />
        <MetricCard label="False Discoveries"   value={falseDisc}       color={falseDisc > 0 ? '#ff2244' : '#3a5070'}
          sub="Caught by BH" />
      </div>

      {/* FDR explanation box */}
      <div className="glass-card p-4 mb-6" style={{ borderColor: 'rgba(0,255,136,0.2)' }}>
        <div className="text-xs leading-relaxed" style={{ color: '#8aaccc', fontFamily: 'JetBrains Mono,monospace' }}>
          <span style={{ color: '#ffd60a' }}>Multiple comparison problem:</span>
          {' '}Testing {results.length} features simultaneously at α=0.05 expects{' '}
          <strong style={{ color: '#ff2244' }}>{+(results.length * 0.05).toFixed(1)} false positives</strong> by chance.
          {' '}Benjamini-Hochberg FDR controls the expected proportion of false discoveries.
          {' '}{falseDisc > 0
            ? <span style={{ color: '#ff2244' }}>{falseDisc} feature(s) were raw-significant but rejected after BH correction.</span>
            : <span style={{ color: '#00ff88' }}>All {rawSig} raw-significant features survive BH correction.</span>
          }
        </div>
      </div>

      {/* Effect size chart */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Cohen's d — Effect Size Ranking" sub="Top 15 discriminating features (Benign vs Malicious)" />
        <BarChart data={topEffects} xKey="feature" yKey="effect" color="#7b2fff" horizontal height={320} />
      </div>

      {/* Full results table */}
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <SectionHeader title="Full Statistical Test Results"
            sub="q = BH-adjusted p-value · 95% CI via bootstrap (B=500) · ✓✓ = passes FDR" />
          <button onClick={downloadCSV} className="neon-btn text-xs px-3 py-1" style={{ fontSize: 11 }}>
            ↓ Export CSV
          </button>
        </div>
        <div className="overflow-auto max-h-[500px]">
          <table className="data-table">
            <thead>
              <tr>
                {['Feature', 'Ben μ', 'Mal μ', 'd', '95% CI', 'Effect',
                  'MW z', 'MW p', 'r (MW)', 'r Mag',
                  'Welch t', 'df', 'Welch p',
                  'q (BH)', '✓'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={r.bhSig ? { background: 'rgba(0,255,136,0.02)' } : {}}>
                  <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.feature}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.benignMean}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.maliciousMean}</td>
                  <td style={{ color: r.effectColor, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 600 }}>{r.cohensD}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#8aaccc', whiteSpace: 'nowrap' }}>
                    [{r.ciLo}, {r.ciHi}]
                  </td>
                  <td>
                    <span className="stat-badge" style={{ color: r.effectColor, borderColor: r.effectColor + '44', background: r.effectColor + '11', fontSize: 10 }}>
                      {r.effectSize}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.mwZ}</td>
                  <td style={{ color: r.mwP < 0.001 ? '#00ff88' : r.mwP < 0.05 ? '#ffd60a' : '#3a5070', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.mwP}</td>
                  <td style={{ color: '#7b2fff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.mwR}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#3a5070' }}>{r.mwRLabel}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.wtT}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#3a5070' }}>{r.wtDf}</td>
                  <td style={{ color: r.wtP < 0.001 ? '#00ff88' : r.wtP < 0.05 ? '#ffd60a' : '#3a5070', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{r.wtP}</td>
                  <td style={{ color: r.bhSig ? '#00ff88' : r.qValue < 0.1 ? '#ffd60a' : '#3a5070', fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 600 }}>{r.qValue}</td>
                  <td style={{ textAlign: 'center', fontSize: 13 }}>
                    {r.bhSig
                      ? <span style={{ color: '#00ff88' }}>✓✓</span>
                      : r.rawSig
                        ? <span style={{ color: '#ffd60a' }}>✓</span>
                        : <span style={{ color: '#3a5070' }}>✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-6 mt-3 text-xs" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
          <span><span style={{ color: '#00ff88' }}>✓✓</span> BH-FDR significant (q &lt; 0.05)</span>
          <span><span style={{ color: '#ffd60a' }}>✓</span> Raw only (p &lt; 0.05, fails BH)</span>
          <span>d = Cohen's d (pooled SD) · 95% CI = bootstrap (B=500) · r = Kerby rank-biserial</span>
          <span>Welch p = exact t-CDF (df≈{results[0]?.wtDf ?? '?'}) · q = BH-adjusted p-value</span>
        </div>
      </div>

      <InsightBox color="#ffd60a">
        {bhSig}/{results.length} features survive BH-FDR correction (q &lt; 0.05) — controlling false discovery rate at 5%.
        {' '}{falseDisc > 0 ? `${falseDisc} feature(s) appeared significant by raw p but are likely false discoveries.` : `No false discoveries detected.`}
        {' '}{large} features show large effect size (|d| ≥ 0.8) and are the strongest discriminators.
      </InsightBox>
    </div>
  )
}
