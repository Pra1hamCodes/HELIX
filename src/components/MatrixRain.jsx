import { useEffect, useRef } from 'react'

export default function MatrixRain({ opacity = 0.18 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEF'
    const fontSize = 13
    let cols = Math.floor(canvas.width / fontSize)
    const drops = Array(cols).fill(1)

    const draw = () => {
      ctx.fillStyle = `rgba(2,4,9,0.05)`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#00f5ff'
      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`

      cols = Math.floor(canvas.width / fontSize)
      while (drops.length < cols) drops.push(Math.random() * -100)

      for (let i = 0; i < cols; i++) {
        const c = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillStyle = i % 5 === 0 ? '#00ff88' : '#00f5ff'
        ctx.globalAlpha = Math.random() * 0.5 + 0.2
        ctx.fillText(c, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      }
      ctx.globalAlpha = 1
    }

    const id = setInterval(draw, 50)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, opacity, pointerEvents: 'none' }}
    />
  )
}
