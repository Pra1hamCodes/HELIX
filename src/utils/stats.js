/** Pure-JS statistics helpers for in-browser analytics. */

export function mean(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function std(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

export function variance(arr) {
  const s = std(arr)
  return s * s
}

export function skewness(arr) {
  if (arr.length < 3) return 0
  const m = mean(arr), s = std(arr)
  if (s === 0) return 0
  return arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0) / arr.length
}

export function kurtosis(arr) {
  if (arr.length < 4) return 0
  const m = mean(arr), s = std(arr)
  if (s === 0) return 0
  return arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) / arr.length - 3
}

export function min(arr) { return arr.length ? Math.min(...arr) : 0 }
export function max(arr) { return arr.length ? Math.max(...arr) : 0 }

export function percentile(arr, p) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (s.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

export function pearsonCorr(x, y) {
  if (x.length !== y.length || x.length < 2) return 0
  const mx = mean(x), my = mean(y)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i++) {
    const ex = x[i] - mx, ey = y[i] - my
    num += ex * ey
    dx  += ex * ex
    dy  += ey * ey
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

export function valueCounts(arr) {
  const counts = {}
  for (const v of arr) counts[v] = (counts[v] || 0) + 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))
}

export function histogram(arr, bins = 30) {
  if (!arr.length) return []
  const mn = Math.min(...arr), mx = Math.max(...arr)
  const step = (mx - mn) / bins || 1
  const buckets = Array.from({ length: bins }, (_, i) => ({
    bin: mn + i * step,
    count: 0,
  }))
  for (const v of arr) {
    const idx = Math.min(Math.floor((v - mn) / step), bins - 1)
    buckets[idx].count++
  }
  return buckets
}

/** Compute top-N feature variances from rows (array of objects). */
export function featureVariances(rows, numericCols, topN = 30) {
  return numericCols
    .map(col => {
      const vals = rows.map(r => +r[col]).filter(v => isFinite(v))
      return { feature: col, variance: variance(vals) }
    })
    .sort((a, b) => b.variance - a.variance)
    .slice(0, topN)
}

/** Compute correlation matrix for top-N features (sampled). */
export function correlationMatrix(rows, cols, sampleSize = 3000) {
  const sample = rows.length > sampleSize
    ? rows.filter((_, i) => i % Math.floor(rows.length / sampleSize) === 0)
    : rows
  const data = cols.map(col => sample.map(r => +r[col]).filter(isFinite))
  const matrix = cols.map((c, i) =>
    cols.map((d, j) => pearsonCorr(data[i], data[j]))
  )
  return { cols, matrix }
}

/** Clip values to [p1, p99]. */
export function clipOutliers(vals) {
  const p1 = percentile(vals, 1), p99 = percentile(vals, 99)
  return vals.map(v => Math.max(p1, Math.min(p99, v)))
}

/** KDE estimate for smooth distribution curve. */
export function kernelDensity(arr, bandwidth, points = 50) {
  const mn = Math.min(...arr), mx = Math.max(...arr)
  const xs = Array.from({ length: points }, (_, i) => mn + (i / (points - 1)) * (mx - mn))
  const n = arr.length
  return xs.map(x => {
    const y = arr.reduce((s, v) => {
      const u = (x - v) / bandwidth
      return s + Math.exp(-0.5 * u * u)
    }, 0) / (n * bandwidth * Math.sqrt(2 * Math.PI))
    return { x, y }
  })
}

/** Estimate bandwidth using Silverman's rule. */
export function silvermanBandwidth(arr) {
  const n = arr.length, s = std(arr)
  return 1.06 * s * Math.pow(n, -0.2) || 0.1
}
