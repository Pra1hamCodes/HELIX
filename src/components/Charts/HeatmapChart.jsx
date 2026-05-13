import { useMemo } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }

function corrColor(v) {
  const t = (v + 1) / 2
  if (t < 0.5) {
    const s = t / 0.5
    return `rgb(${Math.round(lerp(255, 8, s))},${Math.round(lerp(34, 13, s))},${Math.round(lerp(68, 26, s))})`
  }
  const s = (t - 0.5) / 0.5
  return `rgb(${Math.round(lerp(8, 0, s))},${Math.round(lerp(13, 245, s))},${Math.round(lerp(26, 255, s))})`
}

export default function HeatmapChart({ cols, matrix, maxCols = 20 }) {
  const c = useMemo(() => cols.slice(0, maxCols), [cols, maxCols])
  const m = useMemo(() => matrix.slice(0, maxCols).map(r => r.slice(0, maxCols)), [matrix, maxCols])

  if (!c.length) return null

  const cellSize = Math.max(18, Math.min(36, Math.floor(560 / c.length)))

  return (
    <div className="overflow-auto">
      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${c.length},${cellSize}px)`, gap: 1 }}>
        {/* Header row */}
        <div />
        {c.map((col, i) => (
          <div key={i} className="text-center" style={{
            fontSize: 8, color: '#3a5070', writingMode: 'vertical-rl',
            transform: 'rotate(180deg)', height: 80, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono,monospace',
          }}>
            {col.length > 14 ? col.slice(0, 14) + '…' : col}
          </div>
        ))}
        {/* Data rows */}
        {m.map((row, ri) => (
          <>
            <div key={`l${ri}`} style={{ fontSize: 9, color: '#3a5070', display: 'flex', alignItems: 'center', fontFamily: 'JetBrains Mono,monospace', paddingRight: 4, justifyContent: 'flex-end' }}>
              {c[ri].length > 12 ? c[ri].slice(0, 12) + '…' : c[ri]}
            </div>
            {row.map((v, ci) => (
              <div key={`c${ri}-${ci}`}
                title={`${c[ri]} × ${c[ci]}: ${v.toFixed(3)}`}
                style={{
                  width: cellSize, height: cellSize,
                  background: corrColor(v),
                  opacity: 0.85,
                  cursor: 'default',
                  borderRadius: 2,
                }}
              />
            ))}
          </>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
        <span>-1</span>
        <div className="h-2 flex-1 rounded" style={{ background: 'linear-gradient(90deg,#ff2244,#080d1a,#00f5ff)' }} />
        <span>+1</span>
      </div>
    </div>
  )
}
