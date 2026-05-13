import { useMemo } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import MetricCard from '../components/UI/MetricCard'
import BarChart from '../components/Charts/BarChart'
import {
  BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const ATTACK_COLORS = [
  '#00f5ff','#7b2fff','#ff2244','#ffd60a','#00ff88','#ff9900',
  '#ff61d8','#00e5ff','#b388ff','#69ff47','#ff6d00','#ea80fc',
]

function dayFromFilename(name) {
  const lower = name.toLowerCase().replace(/\.(csv|pcap|txt)$/i, '')
  if (lower.includes('monday'))    return 'Monday'
  if (lower.includes('tuesday'))   return 'Tuesday'
  if (lower.includes('wednesday')) return 'Wednesday'
  if (lower.includes('thursday') && lower.includes('morning'))   return 'Thu AM'
  if (lower.includes('thursday') && lower.includes('afternoon')) return 'Thu PM'
  if (lower.includes('thursday')) return 'Thursday'
  if (lower.includes('friday') && lower.includes('morning'))   return 'Fri AM'
  if (lower.includes('friday') && lower.includes('afternoon')) return 'Fri PM'
  if (lower.includes('friday')) return 'Friday'
  return name.split(/[_\-\.]/)[0].slice(0, 12) || name.slice(0, 12)
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#080d1a', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
      <div style={{ color: '#00f5ff', marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  )
}

export default function TemporalAnalysis() {
  const { files, allRows, labelCounts } = useDataStore()

  const perFile = useMemo(() => {
    return files.map(f => {
      const day = dayFromFilename(f.name)
      const rows = f.rows || []
      const total = rows.length

      const lc = {}
      for (const r of rows) {
        const lbl = r['Label'] || 'Unknown'
        lc[lbl] = (lc[lbl] || 0) + 1
      }

      const attacks = Object.entries(lc)
        .filter(([k]) => k !== 'BENIGN')
        .sort((a, b) => b[1] - a[1])

      return {
        file: f.name,
        day,
        total,
        benign:    lc['BENIGN'] || 0,
        malicious: total - (lc['BENIGN'] || 0),
        topAttack: attacks[0]?.[0] || 'None',
        topCount:  attacks[0]?.[1] || 0,
        classes:   Object.keys(lc).filter(k => k !== 'BENIGN').length,
        lc,
      }
    })
  }, [files])

  // All unique non-benign classes across all files
  const allClasses = useMemo(() => {
    const s = new Set()
    for (const f of perFile) {
      for (const k of Object.keys(f.lc)) if (k !== 'BENIGN') s.add(k)
    }
    return [...s].sort()
  }, [perFile])

  // Stacked bar chart data: one entry per day, fields = attack class counts
  const stackedData = useMemo(() =>
    perFile.map(f => {
      const entry = { day: f.day }
      for (const cls of allClasses) entry[cls] = f.lc[cls] || 0
      return entry
    })
  , [perFile, allClasses])

  // Traffic volume per day
  const volumeData = perFile.map(f => ({
    day:       f.day,
    total:     f.total,
    benign:    f.benign,
    malicious: f.malicious,
  }))

  // Per-file unique attack classes
  const diversityData = perFile.map(f => ({ day: f.day, uniqueAttacks: f.classes }))

  if (files.length === 0) {
    return (
      <div>
        <PageHeader icon="📅" title="Temporal Analysis" sub="Day-by-day attack pattern evolution across CICIDS2017 files" />
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-4">📂</div>
          <div className="text-sm" style={{ color: '#3a5070' }}>No files loaded. Upload CICIDS2017 CSV files to see temporal analysis.</div>
        </div>
      </div>
    )
  }

  const totalMalicious  = perFile.reduce((s, f) => s + f.malicious, 0)
  const peakDay         = perFile.reduce((a, b) => b.malicious > a.malicious ? b : a, perFile[0])
  const maxDiversity    = perFile.reduce((a, b) => b.classes > a.classes ? b : a, perFile[0])

  return (
    <div>
      <PageHeader icon="📅" title="Temporal Analysis"
        sub={`Day-wise attack evolution · ${files.length} file(s) · ${allClasses.length} attack classes`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Files / Days"         value={files.length}              color="#00f5ff" />
        <MetricCard label="Total Malicious"       value={totalMalicious.toLocaleString()} color="#ff2244" sub="across all days" />
        <MetricCard label="Peak Attack Day"       value={peakDay?.day}              color="#ffd60a" sub={`${peakDay?.malicious?.toLocaleString()} attacks`} />
        <MetricCard label="Most Diverse Day"      value={maxDiversity?.day}         color="#7b2fff" sub={`${maxDiversity?.classes} attack types`} />
      </div>

      {/* Per-day summary cards */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Per-Day Traffic Summary" sub="Derived from filename — upload files named by day for best results" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {perFile.map((f, i) => (
            <div key={i} className="rounded-lg p-4"
              style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.1)' }}>
              <div className="text-sm font-bold mb-2" style={{ color: '#00f5ff', fontFamily: 'Oxanium,sans-serif' }}>{f.day}</div>
              <div className="text-xs space-y-1" style={{ fontFamily: 'JetBrains Mono,monospace' }}>
                <div style={{ color: '#8aaccc' }}>Total: <span style={{ color: '#fff' }}>{f.total.toLocaleString()}</span></div>
                <div style={{ color: '#00ff88' }}>Benign: {f.benign.toLocaleString()}</div>
                <div style={{ color: '#ff2244' }}>Attacks: {f.malicious.toLocaleString()}</div>
                <div style={{ color: '#ffd60a', marginTop: 4, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Top: {f.topAttack.slice(0, 22)}
                </div>
                <div style={{ color: '#3a5070', fontSize: 10 }}>{f.classes} unique attack type(s)</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traffic volume chart */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Daily Traffic Volume" sub="Benign vs Malicious breakdown per day" />
        <ResponsiveContainer width="100%" height={260}>
          <RBarChart data={volumeData} margin={{ top: 4, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
            <XAxis dataKey="day" tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
            <YAxis tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip content={<TT />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }} />
            <Bar dataKey="benign"    fill="#00ff88" name="Benign"    radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="malicious" fill="#ff2244" name="Malicious" radius={[4, 4, 0, 0]} opacity={0.85} />
          </RBarChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked attack type chart */}
      {allClasses.length > 0 && (
        <div className="glass-card p-5 mb-6">
          <SectionHeader title="Attack Type Distribution by Day" sub="Stacked — each color is one attack class" />
          <ResponsiveContainer width="100%" height={300}>
            <RBarChart data={stackedData} margin={{ top: 4, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.06)" />
              <XAxis dataKey="day" tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(0,245,255,0.1)' }} />
              <YAxis tick={{ fill: '#3a5070', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip content={<TT />} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: '#3a5070' }} />
              {allClasses.slice(0, 12).map((cls, i) => (
                <Bar key={cls} dataKey={cls} stackId="a" fill={ATTACK_COLORS[i % ATTACK_COLORS.length]} name={cls.slice(0, 20)} />
              ))}
            </RBarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attack diversity per day */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Attack Diversity per Day" sub="Number of unique attack types observed" />
        <BarChart data={diversityData} xKey="day" yKey="uniqueAttacks" color="#7b2fff" height={200} />
      </div>

      {/* Detailed per-day breakdown table */}
      <div className="glass-card p-5 mb-4">
        <SectionHeader title="Detailed Attack Counts by Day" sub="All attack classes across all loaded files" />
        <div className="overflow-auto max-h-80">
          <table className="data-table">
            <thead>
              <tr>
                <th>Attack Class</th>
                {perFile.map(f => <th key={f.file}>{f.day}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {allClasses.map((cls, i) => {
                const total = perFile.reduce((s, f) => s + (f.lc[cls] || 0), 0)
                return (
                  <tr key={i}>
                    <td style={{ color: ATTACK_COLORS[i % ATTACK_COLORS.length], fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{cls}</td>
                    {perFile.map(f => (
                      <td key={f.file} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: f.lc[cls] ? '#8aaccc' : '#1a2540' }}>
                        {(f.lc[cls] || 0).toLocaleString()}
                      </td>
                    ))}
                    <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#ffd60a', fontWeight: 700 }}>
                      {total.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <InsightBox color="#00f5ff">
        {files.length} day(s) of traffic analyzed. Peak attack day: <strong>{peakDay?.day}</strong> ({peakDay?.malicious?.toLocaleString()} malicious flows).
        {' '}<strong>{maxDiversity?.day}</strong> has the most attack diversity ({maxDiversity?.classes} types).
        {' '}Use the last file as a held-out test set to prevent temporal data leakage.
      </InsightBox>
    </div>
  )
}
