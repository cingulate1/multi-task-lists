import React, { useEffect, useState } from 'react'

const PINK = '#e23b8e'

// port ∈ {tm, rm, bm, lm} — the midpoint of each card edge
function portPoint(cardEls, rootRef, itemId, port) {
  const el = cardEls.current.get(itemId)
  const root = rootRef.current
  if (!el || !root) return null
  const r = el.getBoundingClientRect()
  const rr = root.getBoundingClientRect()
  let x, y, ox, oy
  switch (port) {
    case 'rm':
      x = r.right
      y = (r.top + r.bottom) / 2
      ox = 1
      oy = 0
      break
    case 'lm':
      x = r.left
      y = (r.top + r.bottom) / 2
      ox = -1
      oy = 0
      break
    case 'bm':
      x = (r.left + r.right) / 2
      y = r.bottom
      ox = 0
      oy = 1
      break
    case 'tm':
    default:
      x = (r.left + r.right) / 2
      y = r.top
      ox = 0
      oy = -1
      break
  }
  return { x: x - rr.left + ox * 5, y: y - rr.top + oy * 5 }
}

function lineD(p1, p2) {
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
}

export default function ArrowLayer({ links, cardEls, rootRef, tick, armed, cursor, onDeleteLink }) {
  const [paths, setPaths] = useState([])

  // Post-paint measurement (useEffect, not useLayoutEffect): by then every
  // card ref for this commit is attached, so the registry is complete.
  useEffect(() => {
    const out = []
    for (const l of links) {
      const p1 = portPoint(cardEls, rootRef, l.a.item, l.a.corner)
      const p2 = portPoint(cardEls, rootRef, l.b.item, l.b.corner)
      if (p1 && p2) out.push({ id: l.id, d: lineD(p1, p2) })
    }
    setPaths(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, tick])

  let temp = null
  if (armed && cursor) {
    const p1 = portPoint(cardEls, rootRef, armed.item, armed.corner)
    if (p1) temp = lineD(p1, { x: cursor.x, y: cursor.y })
  }

  return (
    <svg className="arrows">
      <defs>
        <marker
          id="ah"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="11"
          markerHeight="11"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path
            d="M 3.5 1.5 L 10 6 L 3.5 10.5"
            fill="none"
            stroke={PINK}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      {paths.map((p) => (
        <g key={p.id}>
          <path
            className="linkHit"
            d={p.d}
            onContextMenu={(e) => {
              e.preventDefault()
              onDeleteLink(p.id)
            }}
          />
          <path className="link" d={p.d} markerStart="url(#ah)" markerEnd="url(#ah)" />
        </g>
      ))}
      {temp && <path className="linkTemp" d={temp} />}
    </svg>
  )
}
