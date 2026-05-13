import { create } from 'zustand'

const useDataStore = create((set, get) => ({
  // Raw + cleaned data
  files: [],           // { name, rawRows, rows, numCols, clipBounds, quality }
  allRows: [],         // merged cleaned rows across files
  numCols: [],
  labelCounts: [],
  featureStats: [],
  attackProfiles: {},
  correlationData: null,
  topVarianceFeatures: [],

  // Analytics summaries (saved by their pages, consumed by ReportGenerator)
  mlSummary: null,    // { model, cvAcc, cvF1, cvAUC, perClassAUC, topFeatures }
  statSummary: null,  // { bhSig, rawSig, falseDisc, topFeatures }

  // UI state
  loading: false,
  loadingMsg: '',
  error: null,
  ready: false,

  setLoading: (loading, loadingMsg = '') => set({ loading, loadingMsg }),
  setError: (error) => set({ error, loading: false }),

  addFile: (fileData) => set(state => {
    const files = [...state.files, fileData]
    return { files }
  }),

  setProcessed: (data) => set({ ...data, loading: false, loadingMsg: '', ready: true }),

  setMlSummary:   (mlSummary)   => set({ mlSummary }),
  setStatSummary: (statSummary) => set({ statSummary }),

  reset: () => set({
    files: [], allRows: [], numCols: [], labelCounts: [],
    featureStats: [], attackProfiles: {}, correlationData: null,
    topVarianceFeatures: [], mlSummary: null, statSummary: null,
    loading: false, loadingMsg: '', error: null, ready: false,
  }),
}))

export default useDataStore
