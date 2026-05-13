import Papa from 'papaparse'
import { percentile, mean, median, std, variance, skewness, kurtosis, min, max, valueCounts } from './stats'

export const LABEL_COL = 'Label'
export const MAX_ROWS   = 80_000   // cap per file for browser performance

/** Parse a single File object. Returns cleaned rows array + metadata. */
export async function parseCSVFile(file, maxRows = MAX_ROWS) {
  return new Promise((resolve, reject) => {
    let rows = []
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      worker: false,
      step(result) {
        if (rows.length < maxRows) rows.push(result.data)
      },
      complete() { resolve(rows) },
      error: reject,
    })
  })
}

/** Strip leading/trailing spaces from all keys and string values. */
function normalizeRow(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim()
    out[key] = typeof v === 'string' ? v.trim() : v
  }
  return out
}

/** Full cleaning pipeline: strip keys, remove Inf/NaN, deduplicate, clip outliers. */
export function cleanRows(rawRows) {
  // Normalize keys
  let rows = rawRows.map(normalizeRow)

  // Remove rows where Label is missing
  rows = rows.filter(r => r[LABEL_COL] != null && r[LABEL_COL] !== '')

  // Get numeric columns
  const numCols = getNumericCols(rows)

  // Replace Infinity with null, then remove rows with any null numeric value
  rows = rows.map(r => {
    const out = { ...r }
    for (const col of numCols) {
      const v = +r[col]
      if (!isFinite(v)) out[col] = null
    }
    return out
  })
  rows = rows.filter(r => numCols.every(c => r[c] !== null && r[c] !== undefined))

  // Compute clip bounds and apply
  const clipBounds = {}
  for (const col of numCols) {
    const vals = rows.map(r => +r[col])
    const p1   = percentile(vals, 1)
    const p99  = percentile(vals, 99)
    const clipped = vals.filter(v => v < p1 || v > p99).length
    clipBounds[col] = { p1, p99, clipped }
    rows = rows.map(r => ({ ...r, [col]: Math.max(p1, Math.min(p99, +r[col])) }))
  }

  // Deduplicate (by JSON stringify – fast enough for 80K rows)
  const seen = new Set()
  const deduped = rows.filter(r => {
    const key = JSON.stringify(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { rows: deduped, numCols, clipBounds }
}

export function getNumericCols(rows) {
  if (!rows.length) return []
  return Object.keys(rows[0]).filter(k => {
    if (k === LABEL_COL || k.startsWith('_')) return false
    const val = rows[0][k]
    return typeof val === 'number' || (typeof val === 'string' && !isNaN(+val))
  })
}

/** Compute per-column quality stats from raw rows. */
export function computeQuality(rawRows, fileName) {
  if (!rawRows.length) return []
  const cols = Object.keys(rawRows[0])
  const n    = rawRows.length

  return cols.map(col => {
    const vals    = rawRows.map(r => r[col])
    const nulls   = vals.filter(v => v == null || v === '' || v === undefined).length
    const infs    = vals.filter(v => v === Infinity || v === -Infinity).length
    const nums    = vals.map(v => +v).filter(isFinite)
    return {
      column:    col,
      dtype:     typeof rawRows[0][col],
      nullCount: nulls,
      nullPct:   +((nulls / n) * 100).toFixed(2),
      infCount:  infs,
      unique:    new Set(vals).size,
      min:       nums.length ? +min(nums).toFixed(4) : '—',
      max:       nums.length ? +max(nums).toFixed(4) : '—',
      mean:      nums.length ? +mean(nums).toFixed(4) : '—',
    }
  })
}

/** Compute per-feature descriptive stats. */
export function computeFeatureStats(rows, numCols) {
  return numCols.map(col => {
    const vals = rows.map(r => +r[col]).filter(isFinite)
    return {
      feature:  col,
      mean:     +mean(vals).toFixed(4),
      median:   +median(vals).toFixed(4),
      std:      +std(vals).toFixed(4),
      variance: +variance(vals).toFixed(4),
      skewness: +skewness(vals).toFixed(4),
      kurtosis: +kurtosis(vals).toFixed(4),
      min:      +min(vals).toFixed(4),
      p25:      +percentile(vals, 25).toFixed(4),
      p75:      +percentile(vals, 75).toFixed(4),
      p95:      +percentile(vals, 95).toFixed(4),
      max:      +max(vals).toFixed(4),
    }
  })
}

/** Value counts for the label column. */
export function getLabelCounts(rows) {
  return valueCounts(rows.map(r => r[LABEL_COL]))
}

/** Compute top-N feature variances. */
export function topFeaturesByVariance(rows, numCols, topN = 20) {
  return numCols
    .map(col => {
      const vals = rows.map(r => +r[col]).filter(isFinite)
      return { feature: col, variance: +variance(vals).toFixed(4) }
    })
    .sort((a, b) => b.variance - a.variance)
    .slice(0, topN)
}

/** Pearson correlation between all top-N cols (sampled). */
export function computeCorrelationMatrix(rows, numCols, topN = 20, sample = 5000) {
  const cols    = topN < numCols.length ? numCols.slice(0, topN) : numCols
  const sampled = rows.length > sample
    ? Array.from({ length: sample }, (_, i) => rows[Math.floor(i * rows.length / sample)])
    : rows
  function pc(x, y) {
    const mx = x.reduce((a,b)=>a+b,0)/x.length
    const my = y.reduce((a,b)=>a+b,0)/y.length
    let num=0,dx=0,dy=0
    for(let i=0;i<x.length;i++){const ex=x[i]-mx,ey=y[i]-my;num+=ex*ey;dx+=ex*ex;dy+=ey*ey}
    return dx&&dy?num/Math.sqrt(dx*dy):0
  }
  // Filter to rows where all cols are finite — ensures aligned arrays
  const validRows = sampled.filter(r => cols.every(c => isFinite(+r[c])))
  const data   = cols.map(c => validRows.map(r => +r[c]))
  const matrix = cols.map((c, i) => cols.map((d, j) => +pc(data[i], data[j]).toFixed(4)))
  return { cols, matrix }
}

/** Per-class mean for radar features. */
export function computeAttackProfiles(rows, numCols) {
  const classes = [...new Set(rows.map(r => r[LABEL_COL]))]
  const profile = {}
  for (const cls of classes) {
    const sub = rows.filter(r => r[LABEL_COL] === cls)
    profile[cls] = {
      count: sub.length,
      pct:   +((sub.length / rows.length) * 100).toFixed(2),
      means: Object.fromEntries(
        numCols.map(c => [c, +mean(sub.map(r => +r[c]).filter(isFinite)).toFixed(4)])
      ),
    }
  }
  return profile
}
