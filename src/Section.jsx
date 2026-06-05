import React from 'react'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import TaskItem from './TaskItem.jsx'

export default function Section({ listKey, tone, color, items, horizontal, addItem, ...rest }) {
  return (
    <div className={`section ${tone} ${horizontal ? 'horizontal' : ''}`}>
      <div className="sectionHeader">
        <button
          className="addBtn"
          title="Add task"
          style={color ? { borderColor: color, color } : undefined}
          onClick={() => addItem(listKey)}
        >
          +
        </button>
      </div>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        <div className={`sectionBody ${horizontal ? 'h' : 'v'}`}>
          {items.map((it) => (
            <TaskItem
              key={it.id}
              item={it}
              listKey={listKey}
              tone={tone}
              color={color}
              count={items.length}
              horizontal={horizontal}
              {...rest}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
