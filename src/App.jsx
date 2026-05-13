import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import MatrixRain from './components/MatrixRain'
import Sidebar from './components/Layout/Sidebar'
import Footer from './components/Layout/Footer'
import LoadingSpinner from './components/UI/LoadingSpinner'
import useDataStore from './store/useDataStore'

const LandingPage         = lazy(() => import('./pages/LandingPage'))
const DataHealth          = lazy(() => import('./pages/DataHealth'))
const EDA                 = lazy(() => import('./pages/EDA'))
const FeatureIntelligence = lazy(() => import('./pages/FeatureIntelligence'))
const AttackPatterns      = lazy(() => import('./pages/AttackPatterns'))
const StatisticalTesting  = lazy(() => import('./pages/StatisticalTesting'))
const MLModeling          = lazy(() => import('./pages/MLModeling'))
const TemporalAnalysis    = lazy(() => import('./pages/TemporalAnalysis'))
const ReportGenerator     = lazy(() => import('./pages/ReportGenerator'))
const InsightsPage        = lazy(() => import('./pages/InsightsPage'))

function Protected({ children }) {
  const ready = useDataStore(s => s.ready)
  if (!ready) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <div className="min-h-screen cyber-grid scanlines" style={{ background: '#020409' }}>
      <MatrixRain opacity={isLanding ? 0.07 : 0.11} />

      {!isLanding && <Sidebar />}

      <main style={{
        marginLeft: isLanding ? 0 : 220,
        marginBottom: isLanding ? 0 : 32,
        minHeight: '100vh',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ padding: isLanding ? 0 : '28px 32px' }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
              <LoadingSpinner msg="Loading module…" />
            </div>
          }>
            <Routes>
              <Route path="/"         element={<LandingPage />} />
              <Route path="/health"   element={<Protected><DataHealth /></Protected>} />
              <Route path="/eda"      element={<Protected><EDA /></Protected>} />
              <Route path="/features" element={<Protected><FeatureIntelligence /></Protected>} />
              <Route path="/attacks"  element={<Protected><AttackPatterns /></Protected>} />
              <Route path="/stats"    element={<Protected><StatisticalTesting /></Protected>} />
              <Route path="/ml"       element={<Protected><MLModeling /></Protected>} />
              <Route path="/temporal" element={<Protected><TemporalAnalysis /></Protected>} />
              <Route path="/report"   element={<Protected><ReportGenerator /></Protected>} />
              <Route path="/insights" element={<Protected><InsightsPage /></Protected>} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {!isLanding && <Footer />}
    </div>
  )
}
