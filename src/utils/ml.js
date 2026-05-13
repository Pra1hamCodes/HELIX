import { mean, variance, percentile } from './stats'

// ═══════════════════════════════════════════════
// DECISION TREE (CART, Gini — class-weighted)
// ═══════════════════════════════════════════════

function weightedGini(labels, w) {
  const totalW = w.reduce((s, v) => s + v, 0)
  if (!totalW) return 0
  const wc = {}
  for (let i = 0; i < labels.length; i++) wc[labels[i]] = (wc[labels[i]] || 0) + w[i]
  let g = 1
  for (const v of Object.values(wc)) g -= (v / totalW) ** 2
  return g
}

function weightedMajority(labels, w) {
  const wc = {}
  for (let i = 0; i < labels.length; i++) wc[labels[i]] = (wc[labels[i]] || 0) + w[i]
  return Object.entries(wc).sort((a, b) => b[1] - a[1])[0][0]
}

function classCounts(labels) {
  const counts = {}
  for (const l of labels) counts[l] = (counts[l] || 0) + 1
  return counts
}

function buildNode(X, y, w, depth, maxDepth, minSamples, importance, totalW, nFeatures) {
  const nodeW  = w.reduce((s, v) => s + v, 0)
  const counts = classCounts(y)
  const cls    = weightedMajority(y, w)

  if (depth >= maxDepth || y.length < minSamples || Object.keys(counts).length === 1) {
    return { leaf: true, cls, counts, n: y.length }
  }

  // Random feature subset: 2*sqrt(p)
  const nTry = Math.max(2, Math.round(2 * Math.sqrt(nFeatures)))
  const feats = Array.from({ length: nFeatures }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, nTry)

  let bestGain = 1e-10, bestFeat = -1, bestThresh = 0
  const parentGini = weightedGini(y, w)
  const n = y.length

  for (const fi of feats) {
    const sorted = [...new Set(X.map(r => r[fi]))].sort((a, b) => a - b)
    const nCand = Math.min(10, sorted.length - 1)
    const thresholds = Array.from({ length: nCand }, (_, k) =>
      sorted[Math.floor((k + 0.5) * sorted.length / nCand)]
    )

    for (const thresh of thresholds) {
      const li = [], ri = []
      for (let i = 0; i < n; i++) (X[i][fi] <= thresh ? li : ri).push(i)
      if (li.length < 2 || ri.length < 2) continue

      const lw = li.map(i => w[i]), rw = ri.map(i => w[i])
      const lW = lw.reduce((s, v) => s + v, 0)
      const rW = rw.reduce((s, v) => s + v, 0)
      const gain = parentGini
        - (lW / nodeW) * weightedGini(li.map(i => y[i]), lw)
        - (rW / nodeW) * weightedGini(ri.map(i => y[i]), rw)

      if (gain > bestGain) { bestGain = gain; bestFeat = fi; bestThresh = thresh }
    }
  }

  if (bestFeat === -1) return { leaf: true, cls, counts, n }

  importance[bestFeat] = (importance[bestFeat] || 0) + (bestGain * nodeW) / totalW

  const li = [], ri = []
  for (let i = 0; i < n; i++) (X[i][bestFeat] <= bestThresh ? li : ri).push(i)

  return {
    leaf: false, feat: bestFeat, thresh: bestThresh, n, counts,
    left:  buildNode(li.map(i => X[i]), li.map(i => y[i]), li.map(i => w[i]), depth+1, maxDepth, minSamples, importance, totalW, nFeatures),
    right: buildNode(ri.map(i => X[i]), ri.map(i => y[i]), ri.map(i => w[i]), depth+1, maxDepth, minSamples, importance, totalW, nFeatures),
  }
}

function walkNode(node, x) {
  if (node.leaf) return node
  return x[node.feat] <= node.thresh ? walkNode(node.left, x) : walkNode(node.right, x)
}

export class DecisionTree {
  constructor({ maxDepth = 6, minSamples = 10, classWeight = 'balanced' } = {}) {
    this.maxDepth    = maxDepth
    this.minSamples  = minSamples
    this.classWeight = classWeight
  }

  fit(X, y) {
    this.classes   = [...new Set(y)]
    this.nFeatures = X[0].length
    this._imp      = new Array(this.nFeatures).fill(0)

    // Balanced class weights: w_c = N / (K * n_c) — boosts minority classes
    const cts = {}
    for (const label of y) cts[label] = (cts[label] || 0) + 1
    const K = Object.keys(cts).length, N = y.length
    this._cw = {}
    if (this.classWeight === 'balanced') {
      for (const [cls, cnt] of Object.entries(cts)) this._cw[cls] = N / (K * cnt)
    } else {
      for (const cls of Object.keys(cts)) this._cw[cls] = 1
    }

    const w      = y.map(label => this._cw[label])
    const totalW = w.reduce((s, v) => s + v, 0)

    this.root = buildNode(X, y, w, 0, this.maxDepth, this.minSamples, this._imp, totalW, this.nFeatures)
    const total = this._imp.reduce((s, v) => s + v, 0) || 1
    this.featureImportance = this._imp.map(v => v / total)
    return this
  }

  predict(X) { return X.map(x => walkNode(this.root, x).cls) }

  // Weighted leaf purity — accounts for class imbalance in probability estimates
  scorePositive(X, positiveClass) {
    return X.map(x => {
      const leaf = walkNode(this.root, x)
      const posW = (leaf.counts[positiveClass] || 0) * (this._cw?.[positiveClass] || 1)
      const totW = Object.entries(leaf.counts).reduce(
        (s, [c, n]) => s + n * (this._cw?.[c] || 1), 0
      ) || 1
      return posW / totW
    })
  }
}

// ═══════════════════════════════════════════════
// ROC CURVE + AUC
// ═══════════════════════════════════════════════

export function computeROC(scores, yTrue, positiveClass) {
  const binary = yTrue.map(y => (y === positiveClass ? 1 : 0))
  const P = binary.reduce((s, v) => s + v, 0)
  const N = binary.length - P
  if (!P || !N) return { points: [{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }], auc: 0.5 }

  const sorted = scores
    .map((s, i) => ({ s, b: binary[i] }))
    .sort((a, b) => b.s - a.s)

  let tp = 0, fp = 0
  const points = [{ fpr: 0, tpr: 0 }]
  for (const { b } of sorted) {
    if (b === 1) tp++; else fp++
    points.push({ fpr: +(fp / N).toFixed(4), tpr: +(tp / P).toFixed(4) })
  }
  points.push({ fpr: 1, tpr: 1 })

  let auc = 0
  for (let i = 1; i < points.length; i++) {
    auc += (points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr) / 2
  }
  return { points, auc: +Math.abs(auc).toFixed(4) }
}

// ═══════════════════════════════════════════════
// PCA — power iteration on covariance matrix
// ═══════════════════════════════════════════════

function matVec(A, v) {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0))
}

function vecNorm(v) {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
}

function normalize(v) {
  const n = vecNorm(v); return v.map(x => x / n)
}

function powerIter(cov, iters = 80) {
  const p = cov.length
  let v = normalize(Array.from({ length: p }, () => Math.random() - 0.5))
  for (let i = 0; i < iters; i++) v = normalize(matVec(cov, v))
  const eigenval = v.reduce((s, vi, i) => s + vi * matVec(cov, v)[i], 0)
  return { v, eigenval }
}

function deflate(cov, v, lambda) {
  return cov.map((row, i) => row.map((val, j) => val - lambda * v[i] * v[j]))
}

export function computePCA(rows, cols, sampleSize = 2000) {
  if (cols.length < 2 || rows.length < 4) return null

  // Uniform sample
  const step   = rows.length > sampleSize ? Math.floor(rows.length / sampleSize) : 1
  const sample = rows.filter((_, i) => i % step === 0).slice(0, sampleSize)

  const n = sample.length
  const p = cols.length

  // Build centered data matrix
  const X = sample.map(r => cols.map(c => isFinite(+r[c]) ? +r[c] : 0))
  const colMeans = cols.map((_, j) => X.reduce((s, r) => s + r[j], 0) / n)
  const Xc = X.map(r => r.map((v, j) => v - colMeans[j]))

  // Covariance matrix p×p
  const cov = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) =>
      Xc.reduce((s, r) => s + r[i] * r[j], 0) / (n - 1)
    )
  )

  const { v: v1, eigenval: e1 } = powerIter(cov)
  const { v: v2, eigenval: e2 } = powerIter(deflate(cov, v1, e1))

  const totalVar = cov.reduce((s, row, i) => s + row[i], 0) || 1
  const varExplained = [+(e1 / totalVar * 100).toFixed(1), +(e2 / totalVar * 100).toFixed(1)]

  // Project — sample display points (max 100 per class)
  const classBuckets = {}
  sample.forEach((r, idx) => {
    const lbl = r['Label'] || 'Unknown'
    if (!classBuckets[lbl]) classBuckets[lbl] = []
    if (classBuckets[lbl].length < 100) {
      classBuckets[lbl].push({
        pc1: +Xc[idx].reduce((s, v, j) => s + v * v1[j], 0).toFixed(3),
        pc2: +Xc[idx].reduce((s, v, j) => s + v * v2[j], 0).toFixed(3),
        label: lbl,
      })
    }
  })

  const points = Object.values(classBuckets).flat()
  const classes = Object.keys(classBuckets)

  return { points, classes, varExplained }
}

// ═══════════════════════════════════════════════
// t-DISTRIBUTION CDF  (exact via regularized incomplete beta)
// ═══════════════════════════════════════════════

function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  z -= 1
  const p = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7]
  let x = 0.99999999999980993
  for (let i = 0; i < 8; i++) x += p[i] / (z + i + 1)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function betaIncCF(a, b, x) {
  const EPS = 3e-7, FPMIN = 1e-30, MAXIT = 200
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d; let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1/d
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1/d
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    const del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function betaInc(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? bt * betaIncCF(a, b, x) / a
    : 1 - bt * betaIncCF(b, a, 1 - x) / b
}

export function tDistCDF(t, df) {
  const x = df / (df + t * t)
  const ib = 0.5 * betaInc(x, df / 2, 0.5)
  return t < 0 ? ib : 1 - ib
}

// ═══════════════════════════════════════════════
// BENJAMINI-HOCHBERG FDR CORRECTION
// ═══════════════════════════════════════════════

export function bhFDR(pValues) {
  const m = pValues.length
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p)

  // Raw BH adjusted: q(k) = p(k) * m / rank_k  (1-indexed rank)
  const rawQ = indexed.map((item, k) => Math.min(1, item.p * m / (k + 1)))

  // Step-down: enforce monotone decrease from largest rank to smallest
  const stepQ = [...rawQ]
  for (let k = m - 2; k >= 0; k--) stepQ[k] = Math.min(stepQ[k], stepQ[k + 1])

  const qValues = new Array(m)
  for (let k = 0; k < m; k++) qValues[indexed[k].i] = +stepQ[k].toFixed(4)
  return qValues
}

// ═══════════════════════════════════════════════
// PRECISION-RECALL CURVE + AVERAGE PRECISION
// ═══════════════════════════════════════════════

export function computePR(scores, yTrue, positiveClass) {
  const binary = yTrue.map(y => (y === positiveClass ? 1 : 0))
  const P = binary.reduce((s, v) => s + v, 0)
  const prevalence = +(P / binary.length).toFixed(4)
  if (!P) return { points: [], ap: 0, prevalence }

  const sorted = scores
    .map((s, i) => ({ s, b: binary[i] }))
    .sort((a, b) => b.s - a.s)

  let tp = 0, fp = 0
  const points = [{ recall: 0, precision: 1 }]
  for (const { b } of sorted) {
    if (b === 1) tp++; else fp++
    points.push({
      recall:    +(tp / P).toFixed(4),
      precision: +(tp / (tp + fp)).toFixed(4),
    })
  }

  // Average Precision via trapezoid rule
  let ap = 0
  for (let i = 1; i < points.length; i++) {
    ap += (points[i].recall - points[i - 1].recall) * (points[i].precision + points[i - 1].precision) / 2
  }
  return { points, ap: +Math.abs(ap).toFixed(4), prevalence }
}

// ═══════════════════════════════════════════════
// PER-CLASS ONE-VS-REST AUC
// ═══════════════════════════════════════════════

export function computePerClassAUC(scorePositiveFn, Xtest, ytest, classes) {
  return classes.map(cls => {
    const scores = scorePositiveFn(Xtest, cls)
    const { auc } = computeROC(scores, ytest, cls)
    return { cls, auc }
  }).sort((a, b) => b.auc - a.auc)
}

// ═══════════════════════════════════════════════
// STRATIFIED K-FOLD CROSS VALIDATION
// ═══════════════════════════════════════════════

export function stratifiedKFold(X, y, k = 5) {
  const classIdx = {}
  for (let i = 0; i < y.length; i++) {
    const c = y[i]
    if (!classIdx[c]) classIdx[c] = []
    classIdx[c].push(i)
  }

  // Fisher-Yates shuffle per class
  for (const arr of Object.values(classIdx)) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  const folds = Array.from({ length: k }, () => [])
  for (const indices of Object.values(classIdx)) {
    for (let i = 0; i < indices.length; i++) folds[i % k].push(indices[i])
  }

  return folds.map((testFold, fi) => {
    const trainFold = folds.flatMap((f, i) => i !== fi ? f : [])
    return {
      trainX: trainFold.map(i => X[i]),
      trainY: trainFold.map(i => y[i]),
      testX:  testFold.map(i => X[i]),
      testY:  testFold.map(i => y[i]),
    }
  })
}

// ═══════════════════════════════════════════════
// MUTUAL INFORMATION (feature ↔ label)
// Discretized MI: H(Y) - H(Y|X_binned)
// ═══════════════════════════════════════════════

export function computeMutualInfo(rows, featureCols, labelCol = 'Label', sampleSize = 4000) {
  const step   = rows.length > sampleSize ? Math.floor(rows.length / sampleSize) : 1
  const sample = rows.filter((_, i) => i % step === 0)
  const n      = sample.length
  const labels = sample.map(r => r[labelCol])

  // H(Y)
  const lc = {}
  for (const l of labels) lc[l] = (lc[l] || 0) + 1
  let HY = 0
  for (const cnt of Object.values(lc)) { const p = cnt / n; if (p > 0) HY -= p * Math.log2(p) }

  return featureCols.map(col => {
    const vals = sample.map(r => +r[col])
    const finite = vals.filter(isFinite)
    if (finite.length < 10) return { feature: col, mi: 0 }

    const vmin = Math.min(...finite), vmax = Math.max(...finite)
    const range = vmax - vmin || 1
    const nBins = 10

    const binLabels = {}
    for (let i = 0; i < sample.length; i++) {
      const v = vals[i]
      if (!isFinite(v)) continue
      const b = Math.min(nBins - 1, Math.floor((v - vmin) / range * nBins))
      if (!binLabels[b]) binLabels[b] = []
      binLabels[b].push(labels[i])
    }

    let HYX = 0
    for (const group of Object.values(binLabels)) {
      const pb = group.length / n
      const gc = {}
      for (const l of group) gc[l] = (gc[l] || 0) + 1
      let Hb = 0
      for (const cnt of Object.values(gc)) { const p = cnt / group.length; if (p > 0) Hb -= p * Math.log2(p) }
      HYX += pb * Hb
    }

    return { feature: col, mi: +Math.max(0, HY - HYX).toFixed(4) }
  }).sort((a, b) => b.mi - a.mi)
}

// ═══════════════════════════════════════════════
// ANOMALY Z-SCORE: per-class mean z-score for each feature
// returns { classes, features, matrix } where matrix[ci][fi] = z-score
// ═══════════════════════════════════════════════

export function computeAnomalyScores(rows, featureCols, labelCol = 'Label', sampleSize = 3000) {
  const step   = rows.length > sampleSize ? Math.floor(rows.length / sampleSize) : 1
  const sample = rows.filter((_, i) => i % step === 0)

  // Global mean + std per feature
  const globalStats = featureCols.map(col => {
    const vals = sample.map(r => +r[col]).filter(isFinite)
    const mu   = vals.reduce((s, v) => s + v, 0) / (vals.length || 1)
    const sig  = Math.sqrt(vals.reduce((s, v) => s + (v - mu) ** 2, 0) / (vals.length || 1)) || 1
    return { mu, sig }
  })

  // Group rows by class
  const byClass = {}
  for (const r of sample) {
    const cls = r[labelCol] || 'Unknown'
    if (!byClass[cls]) byClass[cls] = []
    byClass[cls].push(r)
  }

  const classes = Object.keys(byClass).sort()

  const matrix = classes.map(cls =>
    featureCols.map((col, fi) => {
      const vals = byClass[cls].map(r => +r[col]).filter(isFinite)
      if (!vals.length) return 0
      const clsMean = vals.reduce((s, v) => s + v, 0) / vals.length
      return +((clsMean - globalStats[fi].mu) / globalStats[fi].sig).toFixed(3)
    })
  )

  return { classes, features: featureCols, matrix }
}
