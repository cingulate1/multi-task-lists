import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { connectionAllowed, toggleMode } from './logic.js'

const PORTS = ['tm', 'rm', 'bm', 'lm']

export default function TaskItem({
  item,
  listKey,
  tone,
  color,
  count,
  horizontal,
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const cardRef = useRef(null)
  const labelBoxRef = useRef(null)
  const editing = editingId === item.id
  const [draft, setDraft] = useState(item.text)

  useLayoutEffect(() => {
    if (editing) setDraft(item.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // Stable identity matters: an inline ref callback would be detached
  // (map cleared) at the start of EVERY commit and re-attached at the end,
  // so anything measuring the registry mid-commit would always see it empty.
  const setCard = useCallback(
    (el) => {
      cardRef.current = el
      if (el) cardEls.current.set(item.id, el)
      else cardEls.current.delete(item.id)
    },
    [item.id, cardEls]
  )

  // Fit text to its slot: wrap first, then walk the font size down until the
  // label no longer overflows. Runs after every render so it tracks window
  // resizes, slot-count changes, and edits.
  useLayoutEffect(() => {
    if (editing) return
    const card = cardRef.current
    const box = labelBoxRef.current
    if (!card || !box) return
    const base = tone === 'band' ? 30 : 20
    let size = base
    card.style.fontSize = size + 'px'
    while (
      size > 8 &&
      (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)
    ) {
      size -= 1
      card.style.fontSize = size + 'px'
    }
  })

  const available =
    armed && armed.item !== item.id && connectionAllowed(board, armed.item, item.id)
  const clickable = toggleMode(board, item.id) !== null

  const slotStyle = {
    flex: `0 0 ${100 / count}%`,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  }

  const startEdit = () => {
    setDraft(item.text)
    setEditingId(item.id)
  }

  return (
    <div className={`slot ${horizontal ? 'h' : 'v'}`} ref={setNodeRef} style={slotStyle}>
      <div
        className={`task ${tone} ${item.checked ? 'checked' : ''} ${isDragging ? 'dragging' : ''}`}
        ref={setCard}
      >
        {PORTS.map((c) => {
          const cls = ['port', c]
          if (armed && armed.item === item.id && armed.corner === c) cls.push('armed')
          else if (available) cls.push('available')
          return (
            <span
              key={c}
              className={cls.join(' ')}
              data-item={item.id}
              data-corner={c}
              onPointerDown={(e) => portDown(item.id, c, e)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                deletePortLinks(item.id, c)
              }}
            />
          )
        })}
        <span
          className="deleteX"
          title="Delete task"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            commitEdit(item.id, '') // empty text deletes the task and its links
          }}
        >
          ×
        </span>
        <span className="handle" {...attributes} {...listeners}>
          &#8801;
        </span>
        <div className="content">
          <span
            className={`checkbox${clickable ? '' : ' locked'}`}
            onClick={() => toggleItem(item.id)}
          >
            {item.checked ? '✓' : ''}
          </span>
          <div className="labelBox" ref={labelBoxRef} style={color ? { color } : undefined}>
            {editing ? (
              <input
                className="editInput"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(item.id, draft)
                  else if (e.key === 'Escape') cancelEdit(item.id)
                }}
                onBlur={() => commitEdit(item.id, draft)}
              />
            ) : (
              <span className="labelText" onDoubleClick={startEdit}>
                {item.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
