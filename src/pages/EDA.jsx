import { useState, useMemo } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import MetricCard from '../components/UI/MetricCard'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import BarChart from '../components/Charts/BarChart'
import PieChart from '../components/Charts/PieChart'
import ComposedHistKDE from '../components/Charts/ComposedHistKDE'
import ClassMeanChart from '../components/Charts/ClassMeanChart'
import { mean, median, std, percentile } from '../utils/stats'
import { getAttackColor } from '../utils/colors'

export default function EDA() {
  const { allRows, numCols, labelCounts, featureStats } = useDataStore()
  const [selectedFeature, setSelectedFeature] = useState(numCols[0] || '')
  const [activeTab, setActiveTab] = useState('histogram')   // histogram | class

  const totalRows = allRows.length
  const benign    = labelCounts.find(l => l.label === 'BENIGN')?.count || 0
  const malicious = totalRows - benign
  const imbalanceRatio = benign && malicious ? (benign / malicious).toFixed(2) : '—'

  // Values for the selected feature
  const selectedVals = useMemo(() => {
    if (!selectedFeature || !allRows.length) return []
    return allRows.map(r => +r[selectedFeature]).filter(isFinite)
  }, [selectedFeature, allRows])

  // Class-conditional stats for selected feature
  const classStats = useMemo(() => {
    if (!selectedFeature || !allRows.length) return []
    const classes = [...new Set(allRows.map(r => r['Label']))]
    return classes.map(cls => {
      const vals = allRows
        .filter(r => r['Label'] === cls)
        .map(r => +r[selectedFeature])
        .filter(isFinite)
      if (!vals.length) return null
      return {
        cls,
        mean:   +mean(vals).toFixed(4),
        std:    +std(vals).toFixed(4),
        median: +median(vals).toFixed(4),
        p25:    +percentile(vals, 25).toFixed(4),
        p75:    +percentile(vals, 75).toFixed(4),
      }
    }).filter(Boolean).sort((a, b) => b.mean - a.mean)
  }, [selectedFeature, allRows])

  const selectedStat = featureStats.find(f => f.feature === selectedFeature)

  const pieData = useMemo(() =>
    labelCounts.slice(0, 12).map(lc => ({
      label: lc.label, count: lc.count, fill: getAttackColor(lc.label),
    })),
    [labelCounts]
  )

  const tabBtn = (id, label) => (
    <button
      onClick={() => setActiveTab(id)}
      className="px-4 py-1.5 rounded text-xs font-semibold transition-all"
      style={{
        fontFamily: 'Oxanium,sans-serif',
        background: activeTab === id ? 'rgba(0,245,255,0.12)' : 'transparent',
        border: `1px solid ${activeTab === id ? '#00f5ff' : 'rgba(0,245,255,0.15)'}`,
        color: activeTab === id ? '#00f5ff' : '#3a5070',
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <PageHeader icon="📊" title="Exploratory Data Analysis" sub="Distributions · KDE overlays · class balance · class-conditional analysis" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Rows" value={totalRows.toLocaleString()} color="#00f5ff" />
        <MetricCard label="Features" value={numCols.length} color="#7b2fff" />
        <MetricCard label="Attack Classes" value={labelCounts.length} color="#ff2244" />
        <MetricCard label="Imbalance" value={`${imbalanceRatio}:1`} color="#ffd60a" sub="Benign:Malicious" />
      </div>

      {/* Class distribution + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-5">
          <SectionHeader title="Class Distribution" sub="Row count per attack class" />
          <BarChart
            data={labelCounts.slice(0, 15).map(lc => ({ label: lc.label, count: lc.count }))}
            xKey="label" yKey="count" multiColor horizontal height={320}
          />
        </div>
        <div className="glass-card p-5">
          <SectionHeader title="Traffic Composition" />
          <PieChart
            data={pieData} nameKey="label" valueKey="count"
            colors={pieData.map(d => d.fill)} height={320}
          />
        </div>
      </div>

      {/* Feature distribution */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Feature Distribution Explorer" sub="Histogram with KDE overlay · class-conditional means ± std" />

        {/* Feature selector */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <select
            value={selectedFeature}
            onChange={e => setSelectedFeature(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg outline-none"
            style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', color: '#cce8ff', fontFamily: 'JetBrains Mono,monospace' }}
          >
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            {tabBtn('histogram', 'Histogram + KDE')}
            {tabBtn('class', 'Class-Conditional')}
          </div>
        </div>

        {/* Quick stats strip */}
        {selectedStat && (
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mb-5">
            {[
              { label: 'Mean',     value: selectedStat.mean },
              { label: 'Median',   value: selectedStat.median },
              { label: 'Std',      value: selectedStat.std },
              { label: 'Skewness', value: selectedStat.skewness },
              { label: 'P25',      value: selectedStat.p25 },
              { label: 'P75',      value: selectedStat.p75 },
              { label: 'P95',      value: selectedStat.p95 },
              { label: 'Kurtosis', value: selectedStat.kurtosis },
            ].map(s => (
              <div key={s.label} className="rounded-lg px-2 py-2 text-center"
                style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.08)' }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif', fontSize: 9 }}>{s.label}</div>
                <div className="font-bold" style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'histogram' && (
          <ComposedHistKDE values={selectedVals} bins={35} color="#00f5ff" height={280} />
        )}

        {activeTab === 'class' && classStats.length > 0 && (
          <ClassMeanChart data={classStats} height={Math.max(280, classStats.length * 28)} />
        )}
      </div>

      {/* Feature stats table — now with percentiles */}
      <div className="glass-card p-5 mb-4">
        <SectionHeader title="Feature Statistics Table" sub={`${featureStats.length} numeric features · click row to inspect distribution`} />
        <div className="overflow-auto max-h-80">
          <table className="data-table">
            <thead>
              <tr>
                {['Feature', 'Mean', 'Median', 'Std', 'P25', 'P75', 'P95', 'Skewness', 'Kurtosis'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {featureStats.map((f, i) => (
                <tr key={i} onClick={() => { setSelectedFeature(f.feature); setActiveTab('histogram') }} className="cursor-pointer">
                  <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.feature}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.mean}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#7b2fff' }}>{f.median}</td>
                  <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{f.std}</td>
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

      <InsightBox color="#00f5ff">
        {labelCounts.length} classes · Benign {benign.toLocaleString()} ({((benign / totalRows) * 100).toFixed(1)}%) vs Malicious {malicious.toLocaleString()} ({((malicious / totalRows) * 100).toFixed(1)}%) · Imbalance ratio {imbalanceRatio}:1 — SMOTE or class_weight="balanced" recommended before training.
      </InsightBox>
    </div>
  )
}
