import { useMemo } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'

// ── helpers ────────────────────────────────────────────────────────────────
function trafficLight(status) {
  return status === 'ok' ? '#00ff88' : status === 'warn' ? '#ffd60a' : '#ff2244'
}

function Card({ title, status = 'ok', children }) {
  const c = trafficLight(status)
  return (
    <div style={{
      background: 'rgba(4,8,18,0.7)',
      border: `1px solid ${c}22`,
      borderLeft: `3px solid ${c}`,
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 10px ${c}` }} />
        <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: '0.82rem', color: c, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.75rem', color: '#8a9db5', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}

function FindingRow({ icon, text, color = '#00f5ff', sub }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,245,255,0.02)', borderBottom: '1px solid rgba(0,245,255,0.04)', marginBottom: 4 }}>
      <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1.6 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.76rem', color, lineHeight: 1.6 }}>{text}</div>
        {sub && <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.65rem', color: '#4a6080', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.18em', color: '#2a4060', textTransform: 'uppercase', padding: '18px 0 8px' }}>
      {children}
    </div>
  )
}

function ScoreGauge({ value, max, label, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.68rem', color: '#8a9db5' }}>{label}</span>
        <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: '0.75rem', color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 1s ease', boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { allRows, labelCounts, numCols, topVarianceFeatures, correlationData, attackProfiles, mlSummary, statSummary, files } = useDataStore()

  const analysis = useMemo(() => {
    if (!allRows.length) return null

    // ── Class diversity ──────────────────────────────────────────────────
    const totalRows      = allRows.length
    const benignRows     = labelCounts.find(l => l.label === 'BENIGN')?.count || 0
    const maliciousRows  = totalRows - benignRows
    const attackClasses  = labelCounts.filter(l => l.label !== 'BENIGN')
    const isBenignOnly   = maliciousRows === 0
    const classCount     = labelCounts.length
    const imbalanceRatio = benignRows > 0 && maliciousRows > 0 ? +(benignRows / maliciousRows).toFixed(1) : null
    const benignPct      = +((benignRows / totalRows) * 100).toFixed(1)

    // ── Feature quality ──────────────────────────────────────────────────
    const totalFeatures = numCols.length
    let redundantPairs = 0
    if (correlationData) {
      const { matrix } = correlationData
      for (let i = 0; i < matrix.length; i++)
        for (let j = i + 1; j < matrix.length; j++)
          if (Math.abs(matrix[i][j]) > 0.9) redundantPairs++
    }
    const topFeat = topVarianceFeatures[0]

    // ── File breakdown ────────────────────────────────────────────────────
    const fileNames = files.map(f => f.name)
    const hasMondayOnly = fileNames.length === 1 && fileNames[0]?.toLowerCase().includes('monday')

    // ── Overall score (0–10) ─────────────────────────────────────────────
    let score = 10
    if (isBenignOnly) score -= 5
    else if (imbalanceRatio && imbalanceRatio > 10) score -= 2
    if (redundantPairs > 10) score -= 1
    if (classCount < 3 && !isBenignOnly) score -= 1
    if (totalFeatures < 30) score -= 1
    score = Math.max(0, Math.min(10, score))

    // ── Categorized findings ─────────────────────────────────────────────
    const critical = []
    const warnings = []
    const ok       = []
    const insights = []

    if (isBenignOnly) {
      critical.push({
        icon: '🚫',
        text: 'Dataset contains ONLY benign traffic — zero attack samples detected.',
        sub: `All ${totalRows.toLocaleString()} rows are labeled BENIGN. MI = 0, accuracy = 100%, and AUC = 0.5 are all mathematically expected — not model failures.`,
      })
      critical.push({
        icon: '📁',
        text: hasMondayOnly
          ? 'Monday.csv is the CICIDS2017 benign-baseline file — it contains no attack traffic by design.'
          : 'Upload attack-containing files to enable full analysis.',
        sub: 'Try: Tuesday.csv (FTP/SSH Brute Force), Wednesday.csv (DoS/Hulk/Slowloris), Thursday.csv (Web Attacks), Friday.csv (PortScan/DDoS/Botnet)',
      })
    } else {
      ok.push({ icon: '✅', text: `${attackClasses.length} distinct attack class${attackClasses.length > 1 ? 'es' : ''} detected across ${totalRows.toLocaleString()} flow records.` })

      if (imbalanceRatio && imbalanceRatio > 15) {
        warnings.push({ icon: '⚠️', text: `Severe class imbalance: ${imbalanceRatio}:1 benign-to-attack ratio (${benignPct}% benign).`, sub: 'Class-weighted training is active to compensate. Interpret accuracy with caution — check per-class F1 scores instead.' })
      } else if (imbalanceRatio && imbalanceRatio > 5) {
        warnings.push({ icon: '⚠️', text: `Moderate class imbalance: ${imbalanceRatio}:1 ratio. Macro-F1 and per-class AUC are more reliable metrics than raw accuracy.` })
      } else if (imbalanceRatio) {
        ok.push({ icon: '✅', text: `Class balance is reasonable at ${imbalanceRatio}:1 — models should train reliably.` })
      }

      const topAttack = attackClasses.sort((a, b) => b.count - a.count)[0]
      if (topAttack) {
        const topPct = +((topAttack.count / maliciousRows) * 100).toFixed(1)
        if (topPct > 60) insights.push({ icon: '📊', text: `${topAttack.label} dominates attack traffic (${topPct}% of malicious rows, ${topAttack.count.toLocaleString()} flows).`, sub: 'This will heavily influence model decision boundaries. Check per-class recall to ensure minority attacks are detected.' })
        else insights.push({ icon: '📊', text: `Attack traffic is reasonably distributed. ${topAttack.label} leads at ${topPct}% of malicious samples.` })
      }
    }

    // Feature findings
    if (redundantPairs > 0) {
      warnings.push({ icon: '🔗', text: `${redundantPairs} highly correlated feature pairs detected (|r| > 0.9).`, sub: 'These redundant features consume model capacity without adding information. PCA or manual removal would help.' })
    } else if (correlationData) {
      ok.push({ icon: '✅', text: 'No severe feature redundancy detected — all features contribute independently.' })
    }

    if (topFeat) {
      insights.push({ icon: '🎯', text: `Highest-variance feature: "${topFeat.feature}" (σ²=${topFeat.variance}).`, sub: 'High variance features tend to carry the most discriminative information for classification.' })
    }

    if (totalFeatures > 60) {
      insights.push({ icon: '📐', text: `${totalFeatures} numeric features available — dimensionality is high.`, sub: 'Consider using top-K by variance (currently set to 15 in ML Modeling) to reduce noise.' })
    }

    // ML findings
    if (mlSummary) {
      const acc = mlSummary.cvAcc
      if (acc && acc.mean > 0.98 && isBenignOnly) {
        critical.push({ icon: '🚨', text: `${(acc.mean * 100).toFixed(1)}% CV accuracy is trivially perfect — all predictions are "BENIGN" because no other class exists.` })
      } else if (acc && acc.mean > 0.95) {
        ok.push({ icon: '✅', text: `Strong classifier performance: CV Accuracy ${(acc.mean * 100).toFixed(1)}% ± ${(acc.std * 100).toFixed(1)}%`, sub: 'Verify this holds across attack minority classes by checking per-class recall.' })
      } else if (acc && acc.mean > 0.8) {
        insights.push({ icon: '📈', text: `Moderate CV accuracy of ${(acc.mean * 100).toFixed(1)}%. Consider tuning maxDepth or sampling strategy.` })
      }
    }

    // Stat findings
    if (statSummary) {
      const { bhSig, falseDisc } = statSummary
      if (bhSig > 0) {
        insights.push({ icon: '🔬', text: `${bhSig} features are statistically significant (BH-FDR corrected).`, sub: `Estimated false discoveries: ${falseDisc}. These features show genuine distributional differences between attack classes.` })
      }
    }

    // Data volume
    if (totalRows < 1000) warnings.push({ icon: '⚠️', text: `Small dataset: only ${totalRows} rows. Statistical results may be unreliable.` })
    else if (totalRows > 100000) ok.push({ icon: '✅', text: `Large dataset (${totalRows.toLocaleString()} rows) enables reliable statistical inference and stable cross-validation.` })
    else ok.push({ icon: '✅', text: `Dataset size (${totalRows.toLocaleString()} rows) is sufficient for analysis.` })

    // Recommendations
    const recs = []
    if (isBenignOnly) {
      recs.push('Upload multi-day CICIDS2017 files (Tuesday–Friday) that contain labeled attack traffic.')
      recs.push('Ensure CSVs retain the "Label" column with attack class names.')
    } else {
      if (imbalanceRatio && imbalanceRatio > 10) recs.push('Focus on per-class Precision/Recall instead of overall accuracy — class-weighted training is already enabled.')
      if (redundantPairs > 10) recs.push('Run PCA or drop highly correlated features before ML training to reduce noise.')
      recs.push('Check Temporal Analysis to see if attack patterns vary by day of capture.')
      if (!mlSummary) recs.push('Run ML Modeling to benchmark Decision Tree and Naïve Bayes classifiers.')
      if (!statSummary) recs.push('Run Statistical Testing to identify features with significant distributional differences.')
    }

    const dataStatus  = isBenignOnly ? 'critical' : (imbalanceRatio && imbalanceRatio > 15) ? 'warn' : 'ok'
    const featStatus  = redundantPairs > 10 ? 'warn' : 'ok'
    const mlStatus    = !mlSummary ? 'warn' : (isBenignOnly ? 'critical' : 'ok')
    const statStatus  = !statSummary ? 'warn' : 'ok'

    return {
      totalRows, benignRows, maliciousRows, attackClasses, isBenignOnly, classCount,
      imbalanceRatio, benignPct, totalFeatures, redundantPairs, topFeat, score,
      critical, warnings, ok, insights, recs,
      dataStatus, featStatus, mlStatus, statStatus,
    }
  }, [allRows, labelCounts, numCols, topVarianceFeatures, correlationData, mlSummary, statSummary, files])

  if (!analysis) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '2rem' }}>💡</div>
      <div style={{ fontFamily: 'Oxanium,sans-serif', color: '#2a4060', fontSize: '0.85rem' }}>Upload data to generate insights</div>
    </div>
  )

  const { critical, warnings, ok, insights, recs, score, dataStatus, featStatus, mlStatus, statStatus, isBenignOnly, totalRows, attackClasses, totalFeatures, redundantPairs, imbalanceRatio } = analysis

  const scoreColor = score >= 7 ? '#00ff88' : score >= 4 ? '#ffd60a' : '#ff2244'

  return (
    <div>
      <PageHeader icon="💡" title="Intelligence Brief"
        sub="Auto-generated dataset insights · health assessment · analytical findings" />

      {/* ── Overview row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {/* Overall Score */}
        <div style={{ gridColumn: 'span 1', background: 'rgba(4,8,18,0.7)', border: `1px solid ${scoreColor}22`, borderRadius: 12, padding: '18px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: '3rem', fontWeight: 700, color: scoreColor, lineHeight: 1, marginBottom: 6 }}>{score}</div>
          <div style={{ fontFamily: 'Oxanium,sans-serif', fontSize: '0.62rem', color: scoreColor, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>Dataset Score</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.6rem', color: '#3a5070' }}>out of 10</div>
        </div>

        {/* Status gauges */}
        <div style={{ gridColumn: 'span 3', background: 'rgba(4,8,18,0.7)', border: '1px solid rgba(0,245,255,0.07)', borderRadius: 12, padding: '18px 24px' }}>
          <ScoreGauge value={isBenignOnly ? 0 : Math.min(10, attackClasses.length)} max={10} label="Attack Class Diversity" color="#00f5ff" />
          <ScoreGauge value={Math.min(10, totalFeatures)} max={10} label="Feature Count (capped at 10)" color="#7b2fff" />
          <ScoreGauge value={10 - Math.min(10, redundantPairs)} max={10} label="Feature Independence" color="#00ff88" />
          <ScoreGauge value={mlSummary ? (isBenignOnly ? 0 : 8) : 0} max={10} label="ML Analysis Coverage" color="#ffd60a" />
        </div>
      </div>

      {/* ── Health checks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card title="Data Composition" status={dataStatus}>
          <div>Rows: <span style={{ color: '#00f5ff' }}>{totalRows.toLocaleString()}</span></div>
          <div>Benign: <span style={{ color: '#00ff88' }}>{analysis.benignRows.toLocaleString()} ({analysis.benignPct}%)</span></div>
          <div>Malicious: <span style={{ color: isBenignOnly ? '#ff2244' : '#ff9900' }}>{analysis.maliciousRows.toLocaleString()}</span></div>
          {imbalanceRatio && <div>Imbalance ratio: <span style={{ color: '#ffd60a' }}>{imbalanceRatio}:1</span></div>}
          {isBenignOnly && <div style={{ marginTop: 8, color: '#ff2244' }}>⚠ No attack samples — upload attack CSVs</div>}
        </Card>
        <Card title="Feature Health" status={featStatus}>
          <div>Numeric features: <span style={{ color: '#00f5ff' }}>{totalFeatures}</span></div>
          <div>Redundant pairs (|r|>0.9): <span style={{ color: redundantPairs > 10 ? '#ff2244' : '#00ff88' }}>{redundantPairs}</span></div>
          <div>Top variance feature: <span style={{ color: '#7b2fff' }}>{analysis.topFeat?.feature?.slice(0, 28) || '—'}</span></div>
        </Card>
        <Card title="ML Analysis" status={mlStatus}>
          {mlSummary ? (
            <>
              <div>Model: <span style={{ color: '#00f5ff' }}>{mlSummary.model}</span></div>
              <div>CV Accuracy: <span style={{ color: '#00ff88' }}>{mlSummary.cvAcc ? (mlSummary.cvAcc.mean * 100).toFixed(1) : '—'}%</span></div>
              <div>CV Macro-F1: <span style={{ color: '#ffd60a' }}>{mlSummary.cvF1 ? (mlSummary.cvF1.mean * 100).toFixed(1) : '—'}%</span></div>
              {isBenignOnly && <div style={{ marginTop: 8, color: '#ff2244' }}>⚠ Trivial — single-class data</div>}
            </>
          ) : (
            <div style={{ color: '#2a4060' }}>Not yet run — go to ML Modeling page</div>
          )}
        </Card>
        <Card title="Statistical Testing" status={statStatus}>
          {statSummary ? (
            <>
              <div>BH-significant features: <span style={{ color: '#00f5ff' }}>{statSummary.bhSig}</span></div>
              <div>Raw-significant: <span style={{ color: '#00f5ff' }}>{statSummary.rawSig}</span></div>
              <div>Est. false discoveries: <span style={{ color: '#ffd60a' }}>{statSummary.falseDisc}</span></div>
            </>
          ) : (
            <div style={{ color: '#2a4060' }}>Not yet run — go to Statistical Testing page</div>
          )}
        </Card>
      </div>

      {/* ── Critical issues ── */}
      {critical.length > 0 && (
        <>
          <SectionTitle>Critical Issues</SectionTitle>
          {critical.map((f, i) => <FindingRow key={i} {...f} color="#ff2244" />)}
        </>
      )}

      {/* ── Warnings ── */}
      {warnings.length > 0 && (
        <>
          <SectionTitle>Warnings</SectionTitle>
          {warnings.map((f, i) => <FindingRow key={i} {...f} color="#ffd60a" />)}
        </>
      )}

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <>
          <SectionTitle>Analytical Findings</SectionTitle>
          {insights.map((f, i) => <FindingRow key={i} {...f} color="#00f5ff" />)}
        </>
      )}

      {/* ── Good things ── */}
      {ok.length > 0 && (
        <>
          <SectionTitle>What Looks Good</SectionTitle>
          {ok.map((f, i) => <FindingRow key={i} {...f} color="#00ff88" />)}
        </>
      )}

      {/* ── Recommendations ── */}
      <SectionTitle>Recommendations</SectionTitle>
      <div style={{ background: 'rgba(4,8,18,0.7)', border: '1px solid rgba(0,245,255,0.07)', borderRadius: 12, padding: '18px 20px' }}>
        {recs.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < recs.length - 1 ? '1px solid rgba(0,245,255,0.04)' : 'none' }}>
            <span style={{ color: '#00f5ff', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.73rem', color: '#8a9db5', lineHeight: 1.6 }}>{r}</span>
          </div>
        ))}
      </div>

      {/* ── File breakdown ── */}
      <SectionTitle>Loaded Files</SectionTitle>
      <div style={{ background: 'rgba(4,8,18,0.7)', border: '1px solid rgba(0,245,255,0.07)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {files.map((f, i) => (
          <div key={i} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: '0.7rem',
            fontFamily: 'JetBrains Mono,monospace',
            background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.1)',
            color: '#00f5ff',
          }}>
            {f.name}
            <span style={{ color: '#3a5070', marginLeft: 8 }}>{f.rows?.length?.toLocaleString()} rows</span>
          </div>
        ))}
      </div>

      {/* CICIDS file guide */}
      <div style={{ marginTop: 20, background: 'rgba(4,8,18,0.7)', border: '1px solid rgba(123,47,255,0.15)', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#7b2fff', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
          CICIDS2017 File Reference
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          {[
            { day: 'Monday',    file: 'Monday-WorkingHours.pcap_ISCX.csv',    attacks: 'BENIGN only (baseline)', color: '#00ff88' },
            { day: 'Tuesday',   file: 'Tuesday-WorkingHours.pcap_ISCX.csv',   attacks: 'FTP-Patator, SSH-Patator', color: '#ff9900' },
            { day: 'Wednesday', file: 'Wednesday-workingHours.pcap_ISCX.csv', attacks: 'DoS Hulk, DoS GoldenEye, DoS Slowloris, DoS Slowhttptest, Heartbleed', color: '#ff2244' },
            { day: 'Thursday',  file: 'Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv', attacks: 'Brute Force, XSS, SQL Injection', color: '#ff2244' },
            { day: 'Friday',    file: 'Friday-WorkingHours-Morning.pcap_ISCX.csv', attacks: 'PortScan, DDoS, Web Attacks, Bot', color: '#ff2244' },
          ].map(({ day, file, attacks, color }) => (
            <div key={day} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: '0.72rem', color, marginBottom: 3 }}>{day}</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.6rem', color: '#3a5070', marginBottom: 4, wordBreak: 'break-all' }}>{file}</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.65rem', color: '#8a9db5' }}>{attacks}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
