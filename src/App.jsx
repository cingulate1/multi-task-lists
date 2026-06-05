import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { seed } from './seed.js'
import {
  boardOf,
  buildIndex,
  connectionAllowed,
  migrate,
  sanitizeAll,
  screenOfItem,
  toggleMode,
} from './logic.js'
import Section from './Section.jsx'
import ArrowLayer from './ArrowLayer.jsx'
import Celebration from './Celebration.jsx'

const uid = () => 'i' + Math.random().toString(36).slice(2, 10)
const MID_PALETTE = ['#3ed47f', '#38c8d8', '#8b7cff', '#ffb060', '#ff6b9d', '#62d7b0']
const BAND_COLOR = '#ff4747'
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ---- container helpers ------------------------------------------------------
const mapFrontList = (front, listId, fn) => {
  if (front.top && front.top.id === listId)
    return { ...front, top: { ...front.top, items: fn(front.top.items) } }
  if (front.bottom && front.bottom.id === listId)
    return { ...front, bottom: { ...front.bottom, items: fn(front.bottom.items) } }
  return {
    ...front,
    middle: front.middle.map((l) => (l.id === listId ? { ...l, items: fn(l.items) } : l)),
  }
}

const mapAllItems = (d, fn) => ({
  ...d,
  front: {
    ...d.front,
    top: d.front.top ? { ...d.front.top, items: fn(d.front.top.items) } : null,
    middle: d.front.middle.map((l) => ({ ...l, items: fn(l.items) })),
    bottom: d.front.bottom ? { ...d.front.bottom, items: fn(d.front.bottom.items) } : null,
  },
  back: { ...d.back, lists: d.back.lists.map((l) => ({ ...l, items: fn(l.items) })) },
})

const allLists = (d) =>
  [d.front.top, ...d.front.middle, d.front.bottom, ...d.back.lists].filter(Boolean)

const frontHasList = (front, listId) =>
  (front.top && front.top.id === listId) ||
  (front.bottom && front.bottom.id === listId) ||
  front.middle.some((l) => l.id === listId)

export default function App() {
  const [data, setData] = useState(null)
  const [screen, setScreen] = useState('front')
  const [armed, setArmed] = useState(null) // { item, corner }
  const [cursor, setCursor] = useState(null) // { x, y } relative to root
  const [editingId, setEditingId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [tick, setTick] = useState(0)
  const rootRef = useRef(null)
  const cardEls = useRef(new Map())
  const armedRef = useRef(null)
  const dataRef = useRef(null)
  const dragRef = useRef(null) // pending port drag { x, y, moved }
  const resizeRef = useRef(null) // { boundary, startY, startSizes, rootH }

  useEffect(() => {
    armedRef.current = armed
  }, [armed])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const bump = useCallback(() => setTick((t) => t + 1), [])

  // ---- undo (Ctrl+Z) ------------------------------------------------------
  const histRef = useRef([])

  const mutate = useCallback((updater) => {
    setData((d) => {
      const next = updater(d)
      if (!d || next === d) return next
      histRef.current.push(d)
      if (histRef.current.length > 100) histRef.current.shift()
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z'))) return
      if (e.target && e.target.closest && e.target.closest('.editInput')) return
      e.preventDefault()
      const prev = histRef.current.pop()
      if (prev) {
        setArmed(null)
        setData(prev)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ---- load / save --------------------------------------------------------
  useEffect(() => {
    ;(async () => {
      let s = null
      try {
        s = window.tdl
          ? await window.tdl.load()
          : JSON.parse(localStorage.getItem('gargantua-tdl'))
      } catch {
        s = null
      }
      setData(s && s.front ? sanitizeAll(migrate(s)) : seed())
    })()
  }, [])

  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => {
      try {
        if (window.tdl) window.tdl.save(data)
        else localStorage.setItem('gargantua-tdl', JSON.stringify(data))
      } catch {
        /* ignore */
      }
    }, 350)
    return () => clearTimeout(t)
  }, [data])

  // ---- arrow re-measure triggers ------------------------------------------
  useEffect(() => {
    const onR = () => bump()
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [bump])

  useLayoutEffect(() => {
    bump()
  }, [data, editingId, screen, bump])

  // ---- data ops (id-resolved across faces and containers) ------------------
  const toggleItem = useCallback(
    (id) => {
      mutate((d) => {
        const scr = screenOfItem(d, id)
        if (!scr) return d
        const mode = toggleMode(boardOf(d, scr), id)
        if (!mode) return d // silent no-op
        let clock = d.clock || 0
        const apply = (items) =>
          items.map((it) => {
            if (it.id !== id) return it
            if (mode === 'check') {
              clock += 1
              return { ...it, checked: true, checkedAt: clock }
            }
            return { ...it, checked: false, checkedAt: null }
          })
        const nd = mapAllItems(d, apply)
        return { ...nd, clock }
      })
    },
    [mutate]
  )

  const addItem = useCallback(
    (listKey) => {
      const id = uid()
      const item = { id, text: '', checked: false, checkedAt: null, isNew: true }
      mutate((d) => {
        if (frontHasList(d.front, listKey)) {
          return { ...d, front: mapFrontList(d.front, listKey, (items) => [...items, item]) }
        }
        if (d.back.lists.some((l) => l.id === listKey)) {
          return {
            ...d,
            back: {
              ...d.back,
              lists: d.back.lists.map((l) =>
                l.id === listKey ? { ...l, items: [...l.items, item] } : l
              ),
            },
          }
        }
        return d
      })
      setEditingId(id)
      setArmed(null)
    },
    [mutate]
  )

  const freshList = () => ({
    id: uid(),
    items: [{ id: uid(), text: 'New item', checked: false, checkedAt: null }],
  })

  const addSection = useCallback(
    (role) => {
      const fresh = freshList()
      mutate((d) => {
        if (role === 'middle')
          return { ...d, front: { ...d.front, middle: [...d.front.middle, fresh] } }
        if (role === 'top')
          return d.front.top ? d : { ...d, front: { ...d.front, top: fresh } }
        return d.front.bottom ? d : { ...d, front: { ...d.front, bottom: fresh } }
      })
      setMenuOpen(false)
      setArmed(null)
    },
    [mutate]
  )

  const addBackList = useCallback(() => {
    const fresh = freshList()
    mutate((d) => ({ ...d, back: { ...d.back, lists: [...d.back.lists, fresh] } }))
    setArmed(null)
  }, [mutate])

  const commitEdit = useCallback(
    (id, text) => {
      const t = text.trim()
      mutate((d) => {
        if (!screenOfItem(d, id)) return d
        if (t === '') {
          // cleared text deletes the task and its links
          return sanitizeAll(mapAllItems(d, (items) => items.filter((it) => it.id !== id)))
        }
        return mapAllItems(d, (items) =>
          items.map((it) => (it.id === id ? { ...it, text: t, isNew: false } : it))
        )
      })
      setEditingId((e) => (e === id ? null : e))
    },
    [mutate]
  )

  const cancelEdit = useCallback(
    (id) => {
      mutate((d) => {
        const isNew = allLists(d).some((l) => l.items.some((it) => it.id === id && it.isNew))
        if (!isNew) return d
        return sanitizeAll(mapAllItems(d, (items) => items.filter((it) => it.id !== id)))
      })
      setEditingId((e) => (e === id ? null : e))
    },
    [mutate]
  )

  const deleteLink = useCallback(
    (linkId) => {
      mutate((d) => {
        const fl = d.front.links.filter((l) => l.id !== linkId)
        const bl = d.back.links.filter((l) => l.id !== linkId)
        if (fl.length === d.front.links.length && bl.length === d.back.links.length) return d
        return { ...d, front: { ...d.front, links: fl }, back: { ...d.back, links: bl } }
      })
    },
    [mutate]
  )

  const deletePortLinks = useCallback(
    (itemId, corner) => {
      const hit = (l) =>
        (l.a.item === itemId && l.a.corner === corner) ||
        (l.b.item === itemId && l.b.corner === corner)
      mutate((d) => {
        const fl = d.front.links.filter((l) => !hit(l))
        const bl = d.back.links.filter((l) => !hit(l))
        if (fl.length === d.front.links.length && bl.length === d.back.links.length) return d
        return { ...d, front: { ...d.front, links: fl }, back: { ...d.back, links: bl } }
      })
    },
    [mutate]
  )

  // Create a link between two ends if legal on their shared face.
  const linkData = useCallback((d, A, B) => {
    const scr = screenOfItem(d, A.item)
    if (!scr || scr !== screenOfItem(d, B.item)) return d
    if (!connectionAllowed(boardOf(d, scr), A.item, B.item)) return d
    const link = { id: uid(), a: A, b: B }
    return scr === 'front'
      ? { ...d, front: { ...d.front, links: [...d.front.links, link] } }
      : { ...d, back: { ...d.back, links: [...d.back.links, link] } }
  }, [])

  // ---- port arming / linking ----------------------------------------------
  const portDown = useCallback(
    (itemId, corner, e) => {
      e.stopPropagation()
      e.preventDefault()
      const a = armedRef.current
      dragRef.current = { x: e.clientX, y: e.clientY, moved: false }

      if (a && a.item === itemId && a.corner === corner) {
        setArmed(null)
        dragRef.current = null
        return
      }
      if (a && a.item !== itemId) {
        let linked = false
        mutate((d) => {
          const nd = linkData(d, { item: a.item, corner: a.corner }, { item: itemId, corner })
          if (nd !== d) linked = true
          return nd
        })
        setArmed(linked ? null : { item: itemId, corner })
        if (linked) dragRef.current = null
        return
      }
      setArmed({ item: itemId, corner })
    },
    [mutate, linkData]
  )

  useEffect(() => {
    if (!armed) {
      setCursor(null)
      return
    }
    const move = (e) => {
      const r = rootRef.current?.getBoundingClientRect()
      if (!r) return
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.x
        const dy = e.clientY - dragRef.current.y
        if (dx * dx + dy * dy > 25) dragRef.current.moved = true
      }
      setCursor({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    const up = (e) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag || !drag.moved) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const port = el && el.closest ? el.closest('.port') : null
      if (port && port.dataset.item !== armed.item) {
        mutate((d) =>
          linkData(
            d,
            { item: armed.item, corner: armed.corner },
            { item: port.dataset.item, corner: port.dataset.corner }
          )
        )
      }
      setArmed(null)
    }
    const key = (e) => {
      if (e.key === 'Escape') setArmed(null)
    }
    const down = (e) => {
      if (!e.target.closest || !e.target.closest('.port')) setArmed(null)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', down)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', down)
    }
  }, [armed, mutate, linkData])

  // ---- drag & drop reordering ----------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = useCallback(
    (e) => {
      bump()
      const { active, over } = e
      if (!over || active.id === over.id) return
      mutate((d) => {
        for (const scr of ['front', 'back']) {
          const index = buildIndex(boardOf(d, scr))
          const A = index.get(active.id)
          const B = index.get(over.id)
          if (A && B) {
            if (A.listKey !== B.listKey) return d // cross-list drop: silent no-op
            const move = (items) => arrayMove(items, A.idx, B.idx)
            if (scr === 'front') return sanitizeAll({ ...d, front: mapFrontList(d.front, A.listKey, move) })
            return sanitizeAll({
              ...d,
              back: {
                ...d.back,
                lists: d.back.lists.map((l) =>
                  l.id === A.listKey ? { ...l, items: move(l.items) } : l
                ),
              },
            })
          }
          if (A || B) return d
        }
        return d
      })
    },
    [bump, mutate]
  )

  // ---- section resizing -----------------------------------------------------
  // boundary 'top': adjusts sizes.top (border below the top band).
  // boundary 'bottom': adjusts sizes.bottom (border above the bottom band,
  // when a middle section exists). Resizes intentionally skip undo history.
  const startResize = useCallback(
    (boundary) => (e) => {
      e.preventDefault()
      e.stopPropagation()
      const root = rootRef.current
      const d = dataRef.current
      if (!root || !d) return
      resizeRef.current = {
        boundary,
        startY: e.clientY,
        startSizes: { ...d.front.sizes },
        rootH: root.getBoundingClientRect().height,
      }
      setResizing(true)
    },
    []
  )

  useEffect(() => {
    if (!resizing) return
    document.body.style.cursor = 'ns-resize'
    const move = (e) => {
      const r = resizeRef.current
      if (!r) return
      const delta = (e.clientY - r.startY) / Math.max(1, r.rootH)
      setData((d) => {
        const hasMid = d.front.middle.length > 0
        const sizes = { ...d.front.sizes }
        if (r.boundary === 'top') {
          const hi = hasMid ? (d.front.bottom ? 1 - sizes.bottom - 0.15 : 0.85) : 0.92
          sizes.top = clamp(r.startSizes.top + delta, 0.08, Math.max(0.08, hi))
        } else {
          const hi = d.front.top ? 1 - sizes.top - 0.15 : 0.85
          sizes.bottom = clamp(r.startSizes.bottom - delta, 0.08, Math.max(0.08, hi))
        }
        return { ...d, front: { ...d.front, sizes } }
      })
    }
    const up = () => {
      resizeRef.current = null
      setResizing(false)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    return () => {
      document.body.style.cursor = ''
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
  }, [resizing])

  // ---- create-list menu dismissal -------------------------------------------
  useEffect(() => {
    if (!menuOpen) return
    const down = (e) => {
      if (!e.target.closest || !e.target.closest('.createWrap')) setMenuOpen(false)
    }
    const key = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [menuOpen])

  if (!data) return null

  const board = boardOf(data, screen)
  const hasItems = board.lists.some((l) => l.items.length > 0)
  const allDone = hasItems && board.lists.every((l) => l.items.every((it) => it.checked))

  const common = {
    board,
    armed,
    editingId,
    setEditingId,
    toggleItem,
    commitEdit,
    cancelEdit,
    portDown,
    deletePortLinks,
    cardEls,
    addItem,
  }

  const { top, middle, bottom, sizes } = data.front
  const topStyle =
    middle.length > 0 || bottom ? { flex: `0 0 ${sizes.top * 100}%` } : { flex: '1 1 0' }
  const bottomStyle =
    middle.length > 0 ? { flex: `0 0 ${sizes.bottom * 100}%` } : { flex: '1 1 0' }

  return (
    <div className="appRoot" ref={rootRef}>
      {allDone && <Celebration />}
      <ArrowLayer
        links={board.links}
        cardEls={cardEls}
        rootRef={rootRef}
        tick={tick}
        armed={armed}
        cursor={cursor}
        onDeleteLink={deleteLink}
      />
      <button
        className="flipBtn"
        title={screen === 'front' ? 'Flip to back' : 'Flip to front'}
        onClick={() => {
          setArmed(null)
          setEditingId(null)
          setMenuOpen(false)
          setScreen((s) => (s === 'front' ? 'back' : 'front'))
        }}
      >
        &#8644;
      </button>
      <div className="topFloat">
        {screen === 'front' ? (
          <div className="createWrap">
            <button className="createListBtn" onClick={() => setMenuOpen((o) => !o)}>
              Create List
            </button>
            {menuOpen && (
              <div className="createMenu">
                <button disabled={!!data.front.top} onClick={() => addSection('top')}>
                  Top
                </button>
                <button onClick={() => addSection('middle')}>Middle</button>
                <button disabled={!!data.front.bottom} onClick={() => addSection('bottom')}>
                  Bottom
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="createListBtn" onClick={addBackList}>
            Create List
          </button>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => setArmed(null)}
        onDragMove={bump}
        onDragEnd={onDragEnd}
      >
        {screen === 'front' ? (
          <div className="layout">
            <div className="sectionsArea">
              {top && (
                <div className="bandWrap" style={topStyle}>
                  <Section
                    listKey={top.id}
                    tone="band"
                    color={BAND_COLOR}
                    items={top.items}
                    horizontal={false}
                    {...common}
                  />
                </div>
              )}
              {middle.length > 0 && (
                <div className="bandWrap" style={{ flex: '1 1 0' }}>
                  {top && <div className="resizeStrip" onPointerDown={startResize('top')} />}
                  <div className="columnsRow">
                    {middle.map((l, i) => (
                      <Section
                        key={l.id}
                        listKey={l.id}
                        tone="mid"
                        color={MID_PALETTE[i % MID_PALETTE.length]}
                        items={l.items}
                        horizontal={false}
                        {...common}
                      />
                    ))}
                  </div>
                </div>
              )}
              {bottom && (
                <div className="bandWrap" style={bottomStyle}>
                  {(top || middle.length > 0) && (
                    <div
                      className="resizeStrip"
                      onPointerDown={startResize(middle.length > 0 ? 'bottom' : 'top')}
                    />
                  )}
                  <Section
                    listKey={bottom.id}
                    tone="band"
                    color={BAND_COLOR}
                    items={bottom.items}
                    horizontal={false}
                    {...common}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="layout">
            <div className="columnsRow">
              {data.back.lists.map((l) => (
                <Section
                  key={l.id}
                  listKey={l.id}
                  tone="white"
                  color="#ffffff"
                  items={l.items}
                  horizontal={false}
                  {...common}
                />
              ))}
            </div>
          </div>
        )}
      </DndContext>
    </div>
  )
}
