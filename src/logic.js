// Front face: at most one "top" band, at most one "bottom" band, any number
// of "middle" lists. Bands span the full window width. Back face: middle
// lists only. A "board" is one face: ordered lists plus that face's links.

export function frontLists(front) {
  const out = []
  if (front.top) out.push({ key: front.top.id, role: 'top', items: front.top.items, midIdx: -1 })
  front.middle.forEach((l, i) =>
    out.push({ key: l.id, role: 'mid', items: l.items, midIdx: i })
  )
  if (front.bottom)
    out.push({ key: front.bottom.id, role: 'bottom', items: front.bottom.items, midIdx: -1 })
  return out
}

export function boardOf(data, screen) {
  if (screen === 'front') {
    return { kind: 'front', lists: frontLists(data.front), links: data.front.links }
  }
  return {
    kind: 'back',
    lists: data.back.lists.map((l, i) => ({ key: l.id, role: 'mid', items: l.items, midIdx: i })),
    links: data.back.links,
  }
}

export function buildIndex(board) {
  const map = new Map()
  board.lists.forEach((l, li) =>
    l.items.forEach((item, idx) =>
      map.set(item.id, { listKey: l.key, role: l.role, midIdx: l.midIdx, li, idx, item })
    )
  )
  return map
}

export function screenOfItem(data, id) {
  if (buildIndex(boardOf(data, 'front')).has(id)) return 'front'
  if (buildIndex(boardOf(data, 'back')).has(id)) return 'back'
  return null
}

export function partnersOf(board, id) {
  const out = []
  for (const l of board.links) {
    if (l.a.item === id) out.push(l.b.item)
    else if (l.b.item === id) out.push(l.a.item)
  }
  return out
}

export function linkPairExists(board, x, y) {
  return board.links.some(
    (l) => (l.a.item === x && l.b.item === y) || (l.a.item === y && l.b.item === x)
  )
}

// Structural rules: cross-list only. mid<->mid must be adjacent columns. A
// band connects to a middle list only at the boundary item facing it (top <->
// FIRST item, bottom <-> LAST item). top <-> bottom requires the LAST item of
// the top band.
function structurallyLegal(board, index, aId, bId) {
  const A = index.get(aId)
  const B = index.get(bId)
  if (!A || !B || aId === bId || A.listKey === B.listKey) return false
  const lenOf = (e) => board.lists[e.li].items.length
  if (A.role === 'mid' && B.role === 'mid') return Math.abs(A.midIdx - B.midIdx) === 1
  const pair = (x, y) =>
    A.role === x && B.role === y ? [A, B] : A.role === y && B.role === x ? [B, A] : null
  let p
  if ((p = pair('top', 'mid'))) return p[1].idx === 0
  if ((p = pair('bottom', 'mid'))) return p[1].idx === lenOf(p[1]) - 1
  if ((p = pair('top', 'bottom'))) return p[0].idx === lenOf(p[0]) - 1
  return false
}

export function connectionAllowed(board, aId, bId) {
  const index = buildIndex(board)
  return structurallyLegal(board, index, aId, bId) && !linkPairExists(board, aId, bId)
}

// Returns 'check' | 'uncheck' | null (null = silent no-op).
// - top-band items: sequential within the band only (their links gate OTHERS).
// - everything else: items above in the same list, plus link-partners of those
//   above-items. Bottom-band items are additionally gated by their OWN
//   partners. Any item linked to the top band additionally requires the
//   ENTIRE top band to be complete.
// Uncheck rule: only the most recently completed item of its list.
export function toggleMode(board, id) {
  const index = buildIndex(board)
  const e = index.get(id)
  if (!e) return null
  const items = board.lists[e.li].items

  if (e.item.checked) {
    const maxAt = Math.max(...items.filter((x) => x.checked).map((x) => x.checkedAt))
    return e.item.checkedAt === maxAt ? 'uncheck' : null
  }

  const pre = new Set()
  if (e.role === 'top') {
    for (let j = 0; j < e.idx; j++) pre.add(items[j].id)
  } else {
    for (let j = 0; j < e.idx; j++) {
      pre.add(items[j].id)
      for (const p of partnersOf(board, items[j].id)) pre.add(p)
    }
    if (e.role === 'bottom') {
      for (const p of partnersOf(board, id)) pre.add(p)
    }
    const topList = board.lists.find((l) => l.role === 'top')
    if (topList && partnersOf(board, id).some((p) => index.get(p)?.role === 'top')) {
      for (const it of topList.items) pre.add(it.id)
    }
  }
  pre.delete(id)
  for (const pid of pre) {
    const pe = index.get(pid)
    if (!pe || !pe.item.checked) return null
  }
  return 'check'
}

// Ensure the saved shape is complete (fresh installs, older saves).
export function migrate(data) {
  const front =
    data.front && Array.isArray(data.front.middle) && Array.isArray(data.front.links)
      ? data.front
      : { top: null, middle: [], bottom: null, sizes: { top: 0.18, bottom: 0.18 }, links: [] }
  const sizes =
    front.sizes && typeof front.sizes.top === 'number' && typeof front.sizes.bottom === 'number'
      ? front.sizes
      : { top: 0.18, bottom: 0.18 }
  const back =
    data.back && Array.isArray(data.back.lists) && Array.isArray(data.back.links)
      ? data.back
      : { lists: [], links: [] }
  return { version: 2, clock: data.clock || 0, front: { ...front, sizes }, back }
}

// Drop links on both faces that point at missing items, duplicates, or that
// became structurally illegal after a reorder/delete (silently, per spec).
export function sanitizeAll(data) {
  const clean = (board) => {
    const index = buildIndex(board)
    const seen = new Set()
    const out = []
    for (const l of board.links) {
      if (!structurallyLegal(board, index, l.a.item, l.b.item)) continue
      const key = [l.a.item, l.b.item].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(l)
    }
    return out
  }
  return {
    ...data,
    front: { ...data.front, links: clean(boardOf(data, 'front')) },
    back: { ...data.back, links: clean(boardOf(data, 'back')) },
  }
}
