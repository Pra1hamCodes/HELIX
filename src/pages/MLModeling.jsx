import { useState } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import MetricCard from '../components/UI/MetricCard'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import BarChart from '../components/Charts/BarChart'
import ROCChart from '../components/Charts/ROCChart'
import PRChart from '../components/Charts/PRChart'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import { DecisionTree, computeROC, computePR, computePerClassAUC, stratifiedKFold } from '../utils/ml'
import { mean, std, variance } from '../utils/stats'

// ── Gaussian Naive Bayes ──────────────────────────────────────────────────
class GaussianNB {
  fit(X, y) {
    this.classes = [...new Set(y)]
    this.priors = {}; this.means = {}; this.vars = {}
    for (const c of this.classes) {
      const idx = y.reduce((a, v, i) => { if (v === c) a.push(i); return a }, [])
      this.priors[c] = idx.length / y.length
      this.means[c]  = X[0].map((_, j) => mean(idx.map(i => X[i][j])))
      this.vars[c]   = X[0].map((_, j) => variance(idx.map(i => X[i][j])) + 1e-9)
    }
    return this
  }
  _logProb(c, x) {
    let lp = Math.log(this.priors[c])
    for (let j = 0; j < x.length; j++) {
      const m = this.means[c][j], v = this.vars[c][j]
      lp += -0.5 * Math.log(2 * Math.PI * v) - (x[j] - m) ** 2 / (2 * v)
    }
    return lp
  }
  predict(X) {
    return X.map(x => this.classes.reduce(
      (best, c) => this._logProb(c, x) > this._logProb(best, x) ? c : best,
      this.classes[0]
    ))
  }
  scorePositive(X, positiveClass) {
    return X.map(x => {
      const lps  = this.classes.map(c => this._logProb(c, x))
      const maxLP = Math.max(...lps)
      const exps  = lps.map(v => Math.exp(v - maxLP))
      const sum   = exps.reduce((s, v) => s + v, 0)
      const idx   = this.classes.indexOf(positiveClass)
      return idx >= 0 ? exps[idx] / sum : 0
    })
  }
}

// ── Shared eval helpers ───────────────────────────────────────────────────
function buildCM(yTrue, yPred, classes) {
  const idx = Object.fromEntries(classes.map((c, i) => [c, i]))
  const m   = classes.map(() => classes.map(() => 0))
  for (let i = 0; i < yTrue.length; i++) {
    const r = idx[yTrue[i]], c = idx[yPred[i]]
    if (r !== undefined && c !== undefined) m[r][c]++
  }
  return m
}

function evalMetrics(yTrue, yPred, classes) {
  const mat = buildCM(yTrue, yPred, classes)
  const acc = yTrue.filter((v, i) => v === yPred[i]).length / yTrue.length
  const perClass = classes.map((c, i) => {
    const tp = mat[i][i]
    const fp = mat.reduce((s, r, ri) => ri !== i ? s + r[i] : s, 0)
    const fn = mat[i].reduce((s, v, ci) => ci !== i ? s + v : s, 0)
    const prec = tp + fp ? tp / (tp + fp) : 0
    const rec  = tp + fn ? tp / (tp + fn) : 0
    const f1   = prec + rec ? 2 * prec * rec / (prec + rec) : 0
    return { cls: c, prec: +prec.toFixed(4), rec: +rec.toFixed(4), f1: +f1.toFixed(4), support: tp + fn }
  })
  const macroF1 = +(perClass.reduce((s, p) => s + p.f1, 0) / perClass.length).toFixed(4)
  return { acc: +acc.toFixed(4), macroF1, perClass, mat }
}

const MODELS   = { dt: 'Decision Tree (CART)', gnb: 'Gaussian Naïve Bayes' }
const CV_SAMPLE = { dt: 4000, gnb: 6000 }
const K = 5

export default function MLModeling() {
  const { allRows, numCols, topVarianceFeatures, setMlSummary } = useDataStore()
  const [model, setModel]     = useState('dt')
  const [topK, setTopK]       = useState(15)
  const [result, setResult]   = useState(null)
  const [running, setRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('roc')   // roc | pr | perclass

  const run = () => {
    setRunning(true)
    setResult(null)
    setTimeout(() => {
      try {
        const FEATS = (topVarianceFeatures.length >= topK
          ? topVarianceFeatures.slice(0, topK).map(f => f.feature)
          : numCols.slice(0, topK)
        ).filter(f => numCols.includes(f))

        const SAMPLE = CV_SAMPLE[model]
        const shuffled = [...allRows].sort(() => Math.random() - 0.5).slice(0, SAMPLE)
        const toX = rows => rows.map(r => FEATS.map(f => isFinite(+r[f]) ? +r[f] : 0))
        const toY = rows => rows.map(r => r['Label'])

        const X  = toX(shuffled)
        const y  = toY(shuffled)
        const classes = [...new Set(y)]

        // ── Stratified 5-fold cross-validation ──────────────────────────
        const folds = stratifiedKFold(X, y, K)
        const cvMetrics = folds.map(({ trainX, trainY, testX, testY }) => {
          let clf
          if (model === 'dt') {
            clf = new DecisionTree({ maxDepth: 6, minSamples: 10 }).fit(trainX, trainY)
          } else {
            clf = new GaussianNB().fit(trainX, trainY)
          }
          const ypred = clf.predict(testX)
          const foldClasses = [...new Set([...testY, ...ypred])]
          const m = evalMetrics(testY, ypred, foldClasses)
          // Fold AUC (benign vs rest)
          const scores = clf.scorePositive(testX, 'BENIGN')
          const { auc } = computeROC(scores, testY, 'BENIGN')
          return { acc: m.acc, macroF1: m.macroF1, auc }
        })

        const cvAcc   = cvMetrics.map(m => m.acc)
        const cvF1    = cvMetrics.map(m => m.macroF1)
        const cvAUC   = cvMetrics.map(m => m.auc)

        const cvSummary = {
          acc:  { mean: +mean(cvAcc).toFixed(4),  std: +std(cvAcc).toFixed(4) },
          f1:   { mean: +mean(cvF1).toFixed(4),   std: +std(cvF1).toFixed(4) },
          auc:  { mean: +mean(cvAUC).toFixed(4),  std: +std(cvAUC).toFixed(4) },
          folds: cvMetrics,
        }

        // ── Final model on full sample (80/20 split for curves) ──────────
        const split  = Math.floor(shuffled.length * 0.8)
        const train  = shuffled.slice(0, split)
        const test   = shuffled.slice(split)

        let clf, featureImportance = null
        if (model === 'dt') {
          clf = new DecisionTree({ maxDepth: 6, minSamples: 10 }).fit(toX(train), toY(train))
          featureImportance = FEATS.map((f, i) => ({
            feature: f.slice(0, 28), importance: +clf.featureImportance[i].toFixed(4),
          })).sort((a, b) => b.importance - a.importance).slice(0, 20)
        } else {
          clf = new GaussianNB().fit(toX(train), toY(train))
        }

        const Xtest  = toX(test)
        const ytest  = toY(test)
        const ypred  = clf.predict(Xtest)
        const scoresFn = (X2, cls) => clf.scorePositive(X2, cls)
        const benignScores = scoresFn(Xtest, 'BENIGN')

        const roc            = computeROC(benignScores, ytest, 'BENIGN')
        const pr             = computePR(benignScores, ytest, 'BENIGN')
        const perClassAUC    = computePerClassAUC(scoresFn, Xtest, ytest, classes)
        const m              = evalMetrics(ytest, ypred, classes)

        const resultObj = {
          ...m, classes, roc, pr, perClassAUC, featureImportance,
          cvSummary,
          trainSize: train.length, testSize: test.length,
          modelName: MODELS[model], feats: FEATS,
        }
        setResult(resultObj)
        setMlSummary({
          model:      MODELS[model],
          cvAcc:      cvSummary.acc,
          cvF1:       cvSummary.f1,
          cvAUC:      cvSummary.auc,
          perClassAUC,
          topFeatures: FEATS,
          holdoutAcc:  m.acc,
          holdoutF1:   m.macroF1,
        })
      } catch (e) {
        console.error(e)
      }
      setRunning(false)
    }, 80)
  }

  const tabBtn = (id, label) => (
    <button onClick={() => setActiveTab(id)}
      className="px-4 py-1.5 rounded text-xs font-semibold transition-all"
      style={{
        fontFamily: 'Oxanium,sans-serif',
        background: activeTab === id ? 'rgba(0,245,255,0.12)' : 'transparent',
        border: `1px solid ${activeTab === id ? '#00f5ff' : 'rgba(0,245,255,0.15)'}`,
        color: activeTab === id ? '#00f5ff' : '#3a5070',
      }}>
      {label}
    </button>
  )

  const uniqueLabels = [...new Set(allRows.map(r => r['Label']))]
  const isBenignOnly = uniqueLabels.length <= 1 && uniqueLabels[0] === 'BENIGN'

  if (isBenignOnly) return (
    <div>
      <PageHeader icon="🤖" title="ML Modeling" sub="Decision Tree (CART) · Gaussian NB · stratified 5-fold CV · ROC + PR curves" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: '1.3rem', fontWeight: 700, color: '#ffd60a' }}>Single-Class Dataset</div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.8rem', color: '#4a6080', maxWidth: 520, lineHeight: 1.8 }}>
          All loaded rows are labeled <span style={{ color: '#00ff88' }}>BENIGN</span>.<br />
          ML classification requires at least 2 classes to learn decision boundaries.<br />
          100% accuracy and AUC = 0.5 are trivially expected — not a model insight.
        </div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '0.72rem', color: '#2a4060', maxWidth: 480, lineHeight: 1.8, padding: '14px 20px', background: 'rgba(255,214,10,0.04)', border: '1px solid rgba(255,214,10,0.12)', borderRadius: 12 }}>
          <div style={{ color: '#ff9900', marginBottom: 8, fontWeight: 700 }}>Upload attack-containing files to enable training:</div>
          Tuesday.csv · Wednesday.csv · Thursday.csv · Friday.csv
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader icon="🤖" title="ML Modeling"
        sub="Decision Tree (CART, class-weighted Gini) · Gaussian NB · stratified 5-fold CV · ROC + PR curves · per-class AUC" />

      {/* Config */}
      <div className="glass-card p-5 mb-6">
        <SectionHeader title="Model Configuration" />
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {Object.entries(MODELS).map(([k, label]) => (
              <button key={k} onClick={() => setModel(k)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  fontFamily: 'Oxanium,sans-serif',
                  background: model === k ? 'rgba(0,245,255,0.12)' : 'transparent',
                  border: `1px solid ${model === k ? '#00f5ff' : 'rgba(0,245,255,0.15)'}`,
                  color: model === k ? '#00f5ff' : '#3a5070',
                }}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif' }}>Top-K features</label>
            <input type="range" min={5} max={Math.min(numCols.length, 30)} value={topK}
              onChange={e => setTopK(+e.target.value)} className="accent-cyan-400 w-24" />
            <span className="text-xs" style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace' }}>{topK}</span>
          </div>
          <button onClick={run} disabled={running} className="neon-btn">
            {running ? 'Training…' : 'Train & Evaluate'}
          </button>
          <span className="text-xs" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
            {CV_SAMPLE[model].toLocaleString()} rows · stratified {K}-fold CV · top-K by variance
          </span>
        </div>
        {running && <LoadingSpinner msg={`Running ${K}-fold stratified CV for ${MODELS[model]}…`} />}
      </div>

      {result && (
        <>
          {/* Cross-validation summary */}
          <div className="glass-card p-5 mb-6" style={{ borderColor: 'rgba(0,255,136,0.2)' }}>
            <SectionHeader title={`Stratified ${K}-Fold Cross-Validation Results`}
              sub="Class-proportion preserved in every fold · gold standard for imbalanced datasets" />

            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: `CV Accuracy (mean ± std)`, val: result.cvSummary.acc, color: result.cvSummary.acc.mean > 0.85 ? '#00ff88' : '#ffd60a' },
                { label: `CV Macro F1 (mean ± std)`, val: result.cvSummary.f1,  color: result.cvSummary.f1.mean  > 0.7  ? '#00ff88' : '#ffd60a' },
                { label: `CV AUC (mean ± std)`,      val: result.cvSummary.auc, color: result.cvSummary.auc.mean > 0.85 ? '#00ff88' : '#ffd60a' },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-4 text-center"
                  style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.1)' }}>
                  <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: '#3a5070', fontFamily: 'Oxanium,sans-serif' }}>{s.label}</div>
                  <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'Oxanium,sans-serif', textShadow: `0 0 16px ${s.color}66` }}>
                    {s.val.mean}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
                    ± {s.val.std}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-fold breakdown */}
            <div className="overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>{['Fold', 'Accuracy', 'Macro F1', 'AUC (Benign)'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {result.cvSummary.folds.map((f, i) => (
                    <tr key={i}>
                      <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>Fold {i + 1}</td>
                      <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: f.acc > 0.85 ? '#00ff88' : '#ffd60a' }}>{f.acc}</td>
                      <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: f.macroF1 > 0.7 ? '#00ff88' : '#ffd60a' }}>{f.macroF1}</td>
                      <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: f.auc > 0.85 ? '#00ff88' : '#ffd60a' }}>{f.auc}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid rgba(0,245,255,0.2)' }}>
                    <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 700 }}>Mean ± Std</td>
                    <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 700, color: '#00f5ff' }}>{result.cvSummary.acc.mean} ± {result.cvSummary.acc.std}</td>
                    <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 700, color: '#00f5ff' }}>{result.cvSummary.f1.mean} ± {result.cvSummary.f1.std}</td>
                    <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 700, color: '#00f5ff' }}>{result.cvSummary.auc.mean} ± {result.cvSummary.auc.std}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI row from hold-out split */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Hold-out Accuracy" value={`${(result.acc * 100).toFixed(1)}%`}
              color={result.acc > 0.9 ? '#00ff88' : '#ffd60a'} sub={`n=${result.testSize}`} />
            <MetricCard label="Macro F1" value={result.macroF1} color="#00f5ff" />
            <MetricCard label="ROC AUC" value={result.roc.auc}
              color={result.roc.auc > 0.9 ? '#00ff88' : '#ffd60a'} sub="Benign vs All" />
            <MetricCard label="PR AP" value={result.pr.ap}
              color={result.pr.ap > 0.9 ? '#00ff88' : '#ffd60a'} sub="Avg Precision" />
          </div>

          {/* ROC / PR / Per-class tabs */}
          <div className="glass-card p-5 mb-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <SectionHeader title="Evaluation Curves" sub="Hold-out test set" />
              <div className="flex gap-2">
                {tabBtn('roc', 'ROC Curve')}
                {tabBtn('pr', 'PR Curve')}
                {tabBtn('perclass', 'Per-Class AUC')}
              </div>
            </div>

            {activeTab === 'roc' && (
              <ROCChart points={result.roc.points} auc={result.roc.auc} label={result.modelName} height={300} />
            )}
            {activeTab === 'pr' && (
              <PRChart points={result.pr.points} ap={result.pr.ap} prevalence={result.pr.prevalence} label={result.modelName} height={300} />
            )}
            {activeTab === 'perclass' && (
              <div>
                <div className="text-xs mb-4" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
                  One-vs-Rest AUC for each attack class · AUC=1.0 means perfect separation · AUC=0.5 means no better than random
                </div>
                <div className="overflow-auto max-h-80">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>AUC (one-vs-rest)</th>
                        <th>Quality</th>
                        <th style={{ width: '40%' }}>Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.perClassAUC.map((p, i) => {
                        const color = p.auc >= 0.95 ? '#00ff88' : p.auc >= 0.8 ? '#ffd60a' : p.auc >= 0.6 ? '#ff9900' : '#ff2244'
                        const label = p.auc >= 0.95 ? 'Excellent' : p.auc >= 0.8 ? 'Good' : p.auc >= 0.6 ? 'Fair' : 'Poor'
                        return (
                          <tr key={i}>
                            <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{p.cls}</td>
                            <td style={{ color, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 600 }}>{p.auc}</td>
                            <td><span className="stat-badge" style={{ color, borderColor: color + '44', background: color + '11', fontSize: 10 }}>{label}</span></td>
                            <td>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,245,255,0.08)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${p.auc * 100}%`, background: color }} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Feature importance (DT) + classification report */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {result.featureImportance ? (
              <div className="glass-card p-5">
                <SectionHeader title="Feature Importance" sub="Weighted Gini impurity decrease (CART)" />
                <BarChart
                  data={result.featureImportance.slice(0, 15)}
                  xKey="feature" yKey="importance"
                  color="#7b2fff" horizontal height={320}
                />
              </div>
            ) : (
              <div className="glass-card p-5">
                <SectionHeader title="Per-Class F1" />
                <BarChart
                  data={result.perClass.slice(0, 15).map(p => ({ cls: p.cls.slice(0, 18), f1: p.f1 }))}
                  xKey="cls" yKey="f1" multiColor horizontal height={320}
                />
              </div>
            )}

            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-1">
                <SectionHeader title="Classification Report" sub="Hold-out test set · sorted by F1" />
                <button onClick={() => {
                  const rows = [['Class','Precision','Recall','F1','Support'],
                    ...result.perClass.map(p => [p.cls, p.prec, p.rec, p.f1, p.support])]
                  const csv  = rows.map(r => r.join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a'); a.href = url; a.download = 'classification-report.csv'; a.click()
                  URL.revokeObjectURL(url)
                }} className="neon-btn text-xs px-3 py-1" style={{ fontSize: 11 }}>↓ CSV</button>
              </div>
              <div className="overflow-auto max-h-72">
                <table className="data-table">
                  <thead>
                    <tr>{['Class', 'Prec', 'Recall', 'F1', 'Support'].map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.perClass.sort((a, b) => b.f1 - a.f1).map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{p.cls}</td>
                        {['prec', 'rec', 'f1'].map(k => (
                          <td key={k} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11,
                            color: p[k] > 0.9 ? '#00ff88' : p[k] > 0.7 ? '#ffd60a' : p[k] > 0.4 ? '#ff9900' : '#ff2244' }}>
                            {p[k]}
                          </td>
                        ))}
                        <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#3a5070' }}>{p.support}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid rgba(0,245,255,0.15)' }}>
                      <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 700 }}>macro avg</td>
                      <td colSpan={2} />
                      <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 700 }}>{result.macroF1}</td>
                      <td style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#3a5070' }}>{result.testSize}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Confusion matrix */}
          <div className="glass-card p-5 mb-4">
            <SectionHeader title="Confusion Matrix" sub="Hold-out · cell color intensity = fraction of row total" />
            <div className="overflow-auto">
              <table className="data-table" style={{ fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 100 }}>True \ Pred</th>
                    {result.classes.slice(0, 14).map(c => (
                      <th key={c} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 90, fontSize: 9, minWidth: 28 }}>
                        {c.slice(0, 20)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.mat.slice(0, 14).map((row, ri) => {
                    const rowTotal = row.reduce((s, v) => s + v, 0) || 1
                    return (
                      <tr key={ri}>
                        <td style={{ color: '#00f5ff', fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}>
                          {result.classes[ri].slice(0, 20)}
                        </td>
                        {row.slice(0, 14).map((v, ci) => {
                          const intensity = v / rowTotal
                          return (
                            <td key={ci} style={{
                              textAlign: 'center', minWidth: 28, fontSize: 10,
                              fontFamily: 'JetBrains Mono,monospace',
                              background: ri === ci
                                ? `rgba(0,255,136,${Math.min(0.55, intensity + 0.05)})`
                                : v > 0 ? `rgba(255,34,68,${Math.min(0.45, intensity + 0.04)})` : 'transparent',
                              color: ri === ci ? '#00ff88' : v > 0 ? '#ff2244' : '#3a5070',
                            }}>{v || ''}</td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <InsightBox color="#00ff88">
            {result.modelName} · CV macro F1 {result.cvSummary.f1.mean} ± {result.cvSummary.f1.std} across {K} stratified folds ·
            ROC AUC {result.roc.auc} · PR AP {result.pr.ap} (baseline={result.pr.prevalence}) ·
            {result.featureImportance?.[0] ? ` Top feature: "${result.featureImportance[0].feature}".` : ''}
            {' '}PR-AP well above baseline ({+(result.pr.ap - result.pr.prevalence).toFixed(3)} gain) confirms the model discriminates beyond class prevalence.
          </InsightBox>
        </>
      )}

      {!result && !running && (
        <div className="glass-card p-10 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <div className="text-sm mb-2" style={{ color: '#3a5070' }}>
            Click <strong style={{ color: '#00f5ff' }}>Train & Evaluate</strong> to run stratified {K}-fold cross-validation in-browser.
          </div>
          <div className="text-xs" style={{ color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>
            Outputs: CV mean ± std · ROC curve · Precision-Recall curve · per-class AUC · confusion matrix
          </div>
        </div>
      )}
    </div>
  )
}
