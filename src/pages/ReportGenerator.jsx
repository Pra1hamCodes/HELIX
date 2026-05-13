import { useState } from 'react'
import useDataStore from '../store/useDataStore'
import PageHeader from '../components/UI/PageHeader'
import SectionHeader from '../components/UI/SectionHeader'
import InsightBox from '../components/UI/InsightBox'
import { RiDownload2Line, RiFileCopyLine } from 'react-icons/ri'

function buildReport({
  allRows, files, numCols, labelCounts, featureStats,
  topVarianceFeatures, attackProfiles,
  mlSummary, statSummary,
}) {
  const totalRaw  = files.reduce((s, f) => s + (f.rawRows?.length || 0), 0)
  const retained  = totalRaw ? ((allRows.length / totalRaw) * 100).toFixed(1) : '—'
  const benign    = labelCounts.find(l => l.label === 'BENIGN')?.count || 0
  const malicious = allRows.length - benign
  const classes   = Object.keys(attackProfiles)
  const topFeat   = topVarianceFeatures[0]
  const now       = new Date().toISOString().split('T')[0]

  const lines = [
    `# CICIDS Network Analyst — Automated Report`,
    `**Generated:** ${now} · **Tool:** CICIDS Network Analyst v2 (React/in-browser)`,
    `**Author:** Pra1ham codes · https://github.com/Pra1hamcodes`,
    ``,
    `---`,
    ``,
    `## 1. Dataset Overview`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Files loaded | ${files.length} |`,
    `| Raw rows (total) | ${totalRaw.toLocaleString()} |`,
    `| Clean rows (after cleaning) | ${allRows.length.toLocaleString()} |`,
    `| Retention rate | ${retained}% |`,
    `| Numeric features | ${numCols.length} |`,
    `| Attack classes | ${classes.length} |`,
    ``,
    `---`,
    ``,
    `## 2. Data Health & Cleaning`,
    ``,
    files.map(f => {
      const raw   = f.rawRows?.length || 0
      const clean = f.rows?.length || 0
      const pct   = raw ? ((clean / raw) * 100).toFixed(1) : 0
      return `- **${f.name}**: ${raw.toLocaleString()} raw → ${clean.toLocaleString()} clean (${pct}% retention)`
    }).join('\n'),
    ``,
    `**Cleaning pipeline:** key normalization → Inf/NaN removal → 1st–99th percentile clipping → JSON-hash deduplication.`,
    ``,
    `---`,
    ``,
    `## 3. Class Distribution`,
    ``,
    `| Class | Count | % |`,
    `|-------|-------|---|`,
    ...labelCounts.slice(0, 20).map(lc => `| ${lc.label} | ${lc.count.toLocaleString()} | ${((lc.count / allRows.length) * 100).toFixed(2)}% |`),
    ``,
    `**Benign:** ${benign.toLocaleString()} (${((benign/allRows.length)*100).toFixed(1)}%)  `,
    `**Malicious:** ${malicious.toLocaleString()} (${((malicious/allRows.length)*100).toFixed(1)}%)  `,
    `**Imbalance ratio:** ${benign && malicious ? (benign/malicious).toFixed(1) : '—'}:1`,
    ``,
    `---`,
    ``,
    `## 4. Feature Analysis`,
    ``,
    `### 4.1 Top Features by Variance`,
    ``,
    `| Rank | Feature | Variance |`,
    `|------|---------|----------|`,
    ...topVarianceFeatures.slice(0, 10).map((f, i) => `| ${i+1} | ${f.feature} | ${f.variance} |`),
    ``,
    `**Most discriminative feature:** ${topFeat?.feature} (σ²=${topFeat?.variance})`,
    ``,
    `---`,
    ``,
    `## 5. Statistical Testing (Benign vs Malicious)`,
    ``,
    statSummary
      ? [
          `Tests performed: Mann-Whitney U (non-parametric, rank-based) + Welch's t-test (exact t-CDF).`,
          `Cohen's d with 95% bootstrap confidence intervals (B=500 resamples).`,
          `Multiple comparison correction: Benjamini-Hochberg FDR at α=0.05.`,
          ``,
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Features tested | ${statSummary.total || '—'} |`,
          `| Raw significant (p<0.05) | ${statSummary.rawSig} |`,
          `| BH-FDR significant (q<0.05) | ${statSummary.bhSig} |`,
          `| False discoveries caught | ${statSummary.falseDisc} |`,
          ``,
          `### Top Discriminating Features (by |Cohen's d|)`,
          ``,
          `| Rank | Feature | Cohen's d | 95% CI | Effect | q (BH) |`,
          `|------|---------|-----------|--------|--------|--------|`,
          ...(statSummary.topFeatures || []).slice(0, 10).map((f, i) =>
            `| ${i+1} | ${f.feature} | ${f.cohensD} | [${f.ciLo}, ${f.ciHi}] | ${f.effectSize} | ${f.qValue} |`
          ),
        ].join('\n')
      : `_Run the Statistical Testing page to generate this section._`,
    ``,
    `---`,
    ``,
    `## 6. Machine Learning Results`,
    ``,
    mlSummary
      ? [
          `**Model:** ${mlSummary.model}  `,
          `**Methodology:** Stratified 5-fold cross-validation · class-weighted Gini impurity · balanced class weights (w_c = N / K·n_c)`,
          ``,
          `### Cross-Validation Performance`,
          ``,
          `| Metric | Mean | Std |`,
          `|--------|------|-----|`,
          `| Accuracy | ${mlSummary.cvAcc?.mean} | ±${mlSummary.cvAcc?.std} |`,
          `| Macro F1 | ${mlSummary.cvF1?.mean} | ±${mlSummary.cvF1?.std} |`,
          `| AUC (Benign vs All) | ${mlSummary.cvAUC?.mean} | ±${mlSummary.cvAUC?.std} |`,
          ``,
          `### Per-Class AUC (Hold-out, One-vs-Rest)`,
          ``,
          `| Class | AUC | Quality |`,
          `|-------|-----|---------|`,
          ...(mlSummary.perClassAUC || []).map(p => {
            const q = p.auc >= 0.95 ? 'Excellent' : p.auc >= 0.8 ? 'Good' : p.auc >= 0.6 ? 'Fair' : 'Poor'
            return `| ${p.cls} | ${p.auc} | ${q} |`
          }),
          ``,
          `**Features used (top-K by variance):** ${(mlSummary.topFeatures || []).slice(0, 5).join(', ')}${(mlSummary.topFeatures || []).length > 5 ? ', …' : ''}`,
        ].join('\n')
      : `_Run the ML Modeling page and click "Train & Evaluate" to generate this section._`,
    ``,
    `---`,
    ``,
    `## 7. Attack Class Profiles`,
    ``,
    classes.map(c => {
      const p = attackProfiles[c]
      return `### ${c}\n- Count: ${p.count?.toLocaleString()}\n- Traffic share: ${p.pct}%`
    }).join('\n\n'),
    ``,
    `---`,
    ``,
    `## 8. Methodology Notes`,
    ``,
    `- **Data preprocessing:** 1st–99th percentile clipping eliminates extreme outliers without removing benign flows.`,
    `- **Statistical tests:** Mann-Whitney U is the primary test (non-parametric, robust to non-normality). Welch's t-test uses exact t-CDF via regularized incomplete beta function (Lentz continued fraction).`,
    `- **Bootstrap CI:** 500 bootstrap resamples per feature for Cohen's d 95% confidence intervals.`,
    `- **FDR correction:** Benjamini-Hochberg step-down procedure controls expected proportion of false discoveries.`,
    `- **Decision Tree:** CART with Gini impurity, balanced class weights, random feature subsets (2√p), quantile thresholds.`,
    `- **Cross-validation:** Stratified k-fold (k=5) preserves class proportions in every fold — essential for imbalanced data.`,
    `- **PCA:** Power iteration on covariance matrix with deflation for second eigenvector.`,
    `- **Mutual Information:** Discretized (10 bins) H(Y) − H(Y|X) — captures non-linear feature-label associations.`,
    ``,
    `---`,
    ``,
    `## 9. Recommendations`,
    ``,
    `1. **Class imbalance** — Imbalance ratio ${benign && malicious ? (benign/malicious).toFixed(1) : '—'}:1. Apply SMOTE or class_weight="balanced" before training (DT already uses balanced weights here).`,
    `2. **Feature selection** — Top variance features are strong candidates. Cross-reference with MI rankings and Cohen's d to select the most discriminative subset.`,
    `3. **Model choice** — XGBoost or Random Forest recommended for production. This tool uses CART as the most rigorous in-browser alternative.`,
    `4. **Evaluation** — Use macro-averaged F1 (not accuracy) due to class imbalance. Monitor per-class AUC for rare attacks.`,
    `5. **Temporal split** — Use the last file (e.g., Friday) as test set to prevent temporal data leakage across days.`,
    `6. **Redundant features** — Check the Feature Intelligence page for pairs with |r| > 0.9 and consider dropping one from each pair.`,
    ``,
    `---`,
    ``,
    `*Report generated by CICIDS Network Analyst v2 — built by [Pra1ham codes](https://github.com/Pra1hamcodes)*`,
  ]

  return lines.join('\n')
}

export default function ReportGenerator() {
  const store = useDataStore()
  const [copied, setCopied] = useState(false)

  const report = buildReport(store)

  const download = () => {
    const blob = new Blob([report], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `cicids-report-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = () => {
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasML   = !!store.mlSummary
  const hasStat = !!store.statSummary

  return (
    <div>
      <PageHeader icon="📋" title="Analyst Report" sub="Auto-generated Markdown · statistical testing + ML results + methodology" />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={download} className="neon-btn flex items-center gap-2">
          <RiDownload2Line /> Download .md
        </button>
        <button onClick={copy} className="neon-btn flex items-center gap-2"
          style={{ borderColor: copied ? '#00ff88' : undefined, color: copied ? '#00ff88' : undefined }}>
          <RiFileCopyLine /> {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>

      {/* Section completeness status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold mb-1" style={{ color: '#00f5ff', fontFamily: 'Oxanium,sans-serif' }}>{store.files.length}</div>
          <div className="text-xs" style={{ color: '#3a5070' }}>Files Analyzed</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold mb-1" style={{ color: '#00ff88', fontFamily: 'Oxanium,sans-serif' }}>{store.allRows.length.toLocaleString()}</div>
          <div className="text-xs" style={{ color: '#3a5070' }}>Clean Records</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold mb-1"
            style={{ color: hasStat ? '#00ff88' : '#ff2244', fontFamily: 'Oxanium,sans-serif' }}>
            {hasStat ? '✓' : '—'}
          </div>
          <div className="text-xs" style={{ color: '#3a5070' }}>Stat Testing</div>
          {!hasStat && <div className="text-xs mt-1" style={{ color: '#3a5070' }}>Visit Statistics page</div>}
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold mb-1"
            style={{ color: hasML ? '#00ff88' : '#ff2244', fontFamily: 'Oxanium,sans-serif' }}>
            {hasML ? '✓' : '—'}
          </div>
          <div className="text-xs" style={{ color: '#3a5070' }}>ML Results</div>
          {!hasML && <div className="text-xs mt-1" style={{ color: '#3a5070' }}>Train a model first</div>}
        </div>
      </div>

      {(!hasStat || !hasML) && (
        <div className="glass-card p-4 mb-6" style={{ borderColor: 'rgba(255,210,10,0.2)', background: 'rgba(255,210,10,0.03)' }}>
          <div className="text-xs leading-relaxed" style={{ color: '#ffd60a', fontFamily: 'JetBrains Mono,monospace' }}>
            ⚠ Report is partial — {!hasStat && 'visit the Statistics page to run tests'}{!hasStat && !hasML && ' · '}{!hasML && 'run Train & Evaluate on the ML Modeling page'} to fill in the missing sections.
          </div>
        </div>
      )}

      {/* Rendered report */}
      <div className="glass-card p-6 mb-4">
        <SectionHeader title="Report Preview" sub="Markdown · copy or download above · paste into Notion, GitHub, or any Markdown renderer" />
        <pre className="text-xs overflow-auto max-h-[65vh] whitespace-pre-wrap leading-relaxed"
          style={{ color: '#8aaccc', fontFamily: 'JetBrains Mono,monospace', lineHeight: 1.7 }}>
          {report}
        </pre>
      </div>

      <InsightBox color="#ffd60a">
        Report covers {store.files.length} file(s) · {store.allRows.length.toLocaleString()} rows · {store.numCols.length} features · {Object.keys(store.attackProfiles).length} attack classes.
        {hasStat && ` Stat testing: ${store.statSummary.bhSig} BH-FDR significant features.`}
        {hasML && ` ML CV F1: ${store.mlSummary.cvF1?.mean} ± ${store.mlSummary.cvF1?.std}.`}
        {' '}Download the Markdown file and paste into any Markdown renderer, Notion, or GitHub.
      </InsightBox>
    </div>
  )
}
