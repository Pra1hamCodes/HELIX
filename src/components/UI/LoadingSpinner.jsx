export default function LoadingSpinner({ msg = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#00f5ff', borderRightColor: '#7b2fff' }} />
        <div className="absolute inset-2 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#00ff88', animationDirection: 'reverse', animationDuration: '0.7s' }} />
        <div className="absolute inset-4 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#ff2244', animationDuration: '0.5s' }} />
      </div>
      <div className="text-sm tracking-widest uppercase" style={{ color: '#00f5ff', fontFamily: 'Oxanium,sans-serif' }}>{msg}</div>
    </div>
  )
}
