import React, { useEffect, useRef } from 'react'

// Rendered only when every task on the board is checked: a continuously
// moving, multidirectional sine-wave plasma. Hue spans the full wheel while
// saturation/lightness stay fixed (saturation-normalized — no brown-out),
// drawn at low resolution and upscaled + blurred by CSS.

function hslToRgb(h, s, l) {
  h /= 360
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [
    Math.round(f(h + 1 / 3) * 255),
    Math.round(f(h) * 255),
    Math.round(f(h - 1 / 3) * 255),
  ]
}

// Precomputed hue -> rgb at fixed S/L, so the per-pixel loop is just a lookup.
const LUT = new Uint8Array(360 * 3)
for (let h = 0; h < 360; h++) {
  const [r, g, b] = hslToRgb(h, 0.85, 0.55)
  LUT[h * 3] = r
  LUT[h * 3 + 1] = g
  LUT[h * 3 + 2] = b
}

export default function Celebration() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 192
    const H = 120
    canvas.width = W
    canvas.height = H
    const img = ctx.createImageData(W, H)
    const d = img.data
    const TAU = Math.PI * 2
    let raf
    let t = 0

    const render = () => {
      t += 0.016
      let i = 0
      const swx = Math.sin(t * 0.37) * 1.6
      const swy = Math.cos(t * 0.29) * 1.6
      for (let y = 0; y < H; y++) {
        const v = (y / H) * TAU
        for (let x = 0; x < W; x++) {
          const u = (x / W) * TAU
          const a = Math.sin(u * 1.6 + t * 1.1)
          const b = Math.sin(v * 1.2 - t * 0.9)
          const c = Math.sin(u * 0.7 + v * 0.9 + t * 0.6)
          const cx = u - Math.PI + swx
          const cy = v - Math.PI + swy
          const sw = Math.sin(Math.sqrt(cx * cx + cy * cy) * 2.0 - t * 1.4)
          let hue = (((a + b + c + sw) / 4 + 1) * 180 + t * 14) % 360
          hue = hue | 0
          const k = hue * 3
          d[i++] = LUT[k]
          d[i++] = LUT[k + 1]
          d[i++] = LUT[k + 2]
          d[i++] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas className="celebration" ref={ref} />
}
