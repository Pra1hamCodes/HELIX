import { useState, useMemo } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import MetricCard from '../components/UI/MetricCard'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import BarChart from '../components/Charts/BarChart'
import RadarChart from '../components/Charts/RadarChart'
import { getAttackColor } from '../utils/colors'

const RADAR_FEATURES = [
  'Flow Duration', 'Total Fwd Packets', 'Total Backward Packets',
  'Flow Bytes/s', 'Flow Packets/s', 'Flow IAT Mean',
  'Fwd PSH Flags', 'SYN Flag Count', 'RST Flag Count',
]

export default function AttackPatterns() {
  const { attackProfiles, labelCounts, allRows, numCols } = useDataStore()
  const [selectedClass, setSelectedClass] = useState(Object.keys(attackProfiles)[0] || '')

  const classes = Object.keys(attackProfiles)
  const profile = attackProfiles[selectedClass]
  const isBenignOnly = classes.length === 0 || (classes.length === 1 && classes[0] === 'BENIGN')

  const radarFeatures = useMemo(() => {
    const avail = RADAR_FEATURES.filter(f => numCols.includes(f))
    return avail.length >= 4 ? avail : numCols.slice(0, 8)
  }, [numCols])

  // Build radar data: normalize each feature [0,1] across classes
  const radarData = useMemo(() => {
    const maxPerFeat = {}
    radarFeatures.forEach(f => {
      const vals = classes.map(c => attackProfiles[c]?.means?.[f] || 0)
      maxPerFeat[f] = Math.max(...vals) || 1
    })
    return radarFeatures.map(f => {
      const point = { feature: f.length > 20 ? f.slice(0, 20) + '…' : f }
      classes.slice(0, 8).forEach(c => {
        point[c] = +((attackProfiles[c]?.means?.[f] || 0) / maxPerFeat[f]).toFixed(4)
      })
      return point
    })
  }, [radarFeatures, classes, attackProfiles])

  const radarKeys = classes.slice(0, 8)

  const topMalicious = labelCounts
    .filter(l => l.label !== 'BENIGN')
    .slice(0, 10)

  if (isBenignOnly) return (
    <div>
      <PageHeader icon="🎯" title="Attack Patterns" sub="Per-class profiles · radar signatures · flow fingerprints" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🚫</div>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: '1.3rem', fontWeight: 700, color: '#ff2244' }}>No Attack Traffic Detected</div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.8rem', color: '#4a6080', maxWidth: 520, lineHeight: 1.8 }}>
          Your loaded dataset contains only <span style={{ color: '#00ff88' }}>BENIGN</span> traffic.<br />
          Attack Patterns analysis requires malicious samples to build profiles and radar signatures.
        </div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.72rem', color: '#2a4060', maxWidth: 480, lineHeight: 1.8, padding: '14px 20px', background: 'rgba(255,34,68,0.04)', border: '1px solid rgba(255,34,68,0.12)', borderRadius: 12 }}>
          <div style={{ color: '#ff9900', marginBottom: 8, fontWeight: 700 }}>Upload attack-containing files:</div>
          Tuesday.csv · Wednesday.csv · Thursday.csv · Friday.csv
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader icon="🎯" title="Attack Patterns" sub="Per-class profiles · radar signatures · flow fingerprints" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Attack Classes" value={classes.length} color="#ff2244" />
        <MetricCard label="Malicious Rows" value={(allRows.length - (attackProfiles['BENIGN']?.count || 0)).toLocaleString()} color="#ff9900" />
        <MetricCard label="Benign Rows" value={(attackProfiles['BENIGN']?.count || 0).toLocaleString()} color="#00ff88" />
        <MetricCard label="Top Attack" value={topMalicious[0]?.label?.slice(0, 16) || '—'} color="#ff2244" sub={topMalicious[0]?.count?.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Attack counts bar */}
        <div className="glass-card p-5">
          <SectionHeader title="Malicious Traffic Breakdown" />
          <BarChart
            data={topMalicious.map(l => ({ label: l.label, count: l.count }))}
            xKey="label" yKey="count"
            multiColor horizontal height={280}
          />
        </div>

        {/* Radar */}
        <div className="glass-card p-5">
          <SectionHeader title="Attack Signature Radar" sub="Normalized feature means per class" />
          <RadarChart data={radarData} keys={radarKeys} height={300} />
        </div>
      </div>

      {/* Class selector + profile */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Attack Class Deep-Dive" />
        <div className="flex flex-wrap gap-2 mb-5">
          {classes.map(c => (
            <button key={c}
              onClick={() => setSelectedClass(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Oxanium,sans-serif',
                background: selectedClass === c ? `${getAttackColor(c)}22` : 'transparent',
                border: `1px solid ${selectedClass === c ? getAttackColor(c) : 'rgba(0,245,255,0.1)'}`,
                color: selectedClass === c ? getAttackColor(c) : '#3a5070',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {profile && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <MetricCard label="Count" value={profile.count?.toLocaleString()} color={getAttackColor(selectedClass)} />
              <MetricCard label="Traffic %" value={`${profile.pct}%`} color={getAttackColor(selectedClass)} />
              <MetricCard label="Class" value={selectedClass} color={getAttackColor(selectedClass)} />
            </div>

            <div className="overflow-auto max-h-64">
              <table className="data-table">
                <thead>
                  <tr><th>Feature</th><th>Mean</th></tr>
                </thead>
                <tbody>
                  {Object.entries(profile.means || {}).slice(0, 40).map(([feat, val], i) => (
                    <tr key={i}>
                      <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{feat}</td>
                      <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {topMalicious.length > 0 && (
        <InsightBox color="#ff2244">
          {topMalicious[0]?.label} is the most frequent attack ({topMalicious[0]?.count?.toLocaleString()} rows). Use the radar chart to visually distinguish attack families by flow behavior — DoS attacks cluster around high packet rates, while Patator/PortScan shows distinctive flag patterns.
        </InsightBox>
      )}
    </div>
  )
}
