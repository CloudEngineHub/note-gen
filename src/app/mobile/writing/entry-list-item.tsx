'use client'

import { ReactNode, useRef, useState } from 'react'
import { Cloud, FileText, Folder } from 'lucide-react'
import { BrowserEntry } from './types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type EntryAction = {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void | Promise<void>
  disabled?: boolean
  variant?: 'default' | 'outline' | 'destructive'
}

interface EntryListItemProps {
  entry: BrowserEntry
  isActive: boolean
  onOpen: (entry: BrowserEntry) => void
  actions: EntryAction[]
  remoteLabel: string
  subtitle?: string
  dragDisabled?: boolean
  isDragging?: boolean
  dragOffset?: { x: number; y: number }
  isDropTarget?: boolean
  dropTargetRef?: (node: HTMLDivElement | null) => void
  onDragStart?: (entry: BrowserEntry, point: { x: number; y: number }) => void
  onDragMove?: (point: { x: number; y: number }) => void
  onDragEnd?: (point: { x: number; y: number }) => void
  onDragCancel?: () => void
}

export function EntryListItem({
  entry,
  isActive,
  onOpen,
  actions,
  remoteLabel,
  subtitle,
  dragDisabled = false,
  isDragging = false,
  dragOffset,
  isDropTarget = false,
  dropTargetRef,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: EntryListItemProps) {
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const isSwipingRef = useRef(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const [translateX, setTranslateX] = useState(0)
  const [opened, setOpened] = useState(false)

  const actionWidth = actions.length * 60
  const itemTransform = isDragging && dragOffset
    ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
    : `translateX(${translateX}px)`

  function clearLongPressTimer() {
    if (!longPressTimerRef.current) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0]
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
    isSwipingRef.current = false

    if (!dragDisabled && !opened) {
      clearLongPressTimer()
      longPressTimerRef.current = setTimeout(() => {
        isDraggingRef.current = true
        suppressClickRef.current = true
        setOpened(false)
        setTranslateX(0)
        onDragStart?.(entry, { x: touch.clientX, y: touch.clientY })
      }, 350)
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartXRef.current
    const deltaY = touch.clientY - touchStartYRef.current

    if (isDraggingRef.current) {
      e.preventDefault()
      onDragMove?.({ x: touch.clientX, y: touch.clientY })
      return
    }

    if (Math.hypot(deltaX, deltaY) > 10) {
      clearLongPressTimer()
    }

    if (actions.length === 0) return

    if (!isSwipingRef.current) {
      if (Math.abs(deltaX) < 8) return
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return
      isSwipingRef.current = true
    }

    e.preventDefault()
    const maxLeft = -actionWidth
    const base = opened ? maxLeft : 0
    const next = Math.max(maxLeft, Math.min(0, base + deltaX))
    setTranslateX(next)
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    clearLongPressTimer()
    if (isDraggingRef.current) {
      const touch = e.changedTouches[0]
      isDraggingRef.current = false
      onDragEnd?.({ x: touch.clientX, y: touch.clientY })
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      return
    }

    if (actions.length === 0) return
    const maxLeft = -actionWidth
    const shouldOpen = translateX < maxLeft / 2
    setOpened(shouldOpen)
    setTranslateX(shouldOpen ? maxLeft : 0)
    isSwipingRef.current = false
  }

  function handleTouchCancel() {
    clearLongPressTimer()
    if (isDraggingRef.current) {
      onDragCancel?.()
    }
    isDraggingRef.current = false
    isSwipingRef.current = false
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  return (
    <div
      ref={dropTargetRef}
      className={cn(
        "relative rounded-md bg-background",
        isDragging ? "z-50 overflow-visible" : "overflow-hidden",
        isDropTarget && "outline-2 outline-primary outline-offset-2"
      )}
    >
      {actions.length > 0 && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center gap-2 px-2",
            isDragging && "hidden"
          )}
        >
          {actions.map((action) => (
            <Button
              key={action.key}
              type="button"
              variant={action.variant || 'outline'}
              disabled={action.disabled}
              size="icon"
              className="size-11 rounded-xl shadow-sm"
              onClick={async () => {
                setOpened(false)
                setTranslateX(0)
                await action.onClick()
              }}
              aria-label={action.label}
              title={action.label}
            >
              {action.icon}
              <span className="sr-only">{action.label}</span>
            </Button>
          ))}
        </div>
      )}
      <div
        className={cn(
          "w-full rounded-md border bg-background px-3 py-2 text-left transition-transform duration-200 ease-out active:bg-accent",
          isActive && "border-primary shadow-sm",
          isDropTarget && "border-primary bg-primary/5",
          isDragging && "border-primary bg-background shadow-xl transition-none"
        )}
        style={{ transform: itemTransform }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <button
          type="button"
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            if (opened) {
              setOpened(false)
              setTranslateX(0)
              return
            }
            onOpen(entry)
          }}
          className="w-full min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            {entry.type === 'folder' ? (
              <Folder className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <FileText className="size-4 text-muted-foreground shrink-0" />
            )}
            <p className="text-sm font-medium truncate flex-1 min-w-0">{entry.name}</p>
            {!entry.isLocale && (
              <span
                className="inline-flex items-center shrink-0 text-sky-600 dark:text-sky-400"
                title={remoteLabel}
                aria-label={remoteLabel}
              >
                <Cloud className="size-4 stroke-[2.25]" />
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-1">{subtitle}</p>
          )}
        </button>
      </div>
    </div>
  )
}
