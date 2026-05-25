import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

const SWIPE_THRESHOLD_PX = 40
const SUPPRESS_CLICK_MS = 300

type UseImageCarouselSwipeOptions = {
  count: number
  onIndexChange?: (index: number) => void
}

export const useImageCarouselSwipe = ({ count, onIndexChange }: UseImageCarouselSwipeOptions) => {
  const [index, setIndexState] = useState(0)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const draggingRef = useRef(false)

  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const dragXRef = useRef(0)
  const isHorizontalRef = useRef(false)
  const didSwipeRef = useRef(false)
  const suppressClickUntilRef = useRef(0)
  const containerWidthRef = useRef(0)

  const safeCount = Math.max(count, 1)
  const safeIndex = Math.min(index, safeCount - 1)

  const setIndex = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, safeCount - 1))
      setIndexState(clamped)
      onIndexChange?.(clamped)
    },
    [onIndexChange, safeCount],
  )

  const commitDrag = useCallback(() => {
    const dx = dragXRef.current
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
      didSwipeRef.current = true
      suppressClickUntilRef.current = Date.now() + SUPPRESS_CLICK_MS
      if (dx < 0) {
        setIndex(safeIndex + 1)
      } else {
        setIndex(safeIndex - 1)
      }
    }
    dragXRef.current = 0
    setDragOffsetPx(0)
    draggingRef.current = false
    setIsDragging(false)
    isHorizontalRef.current = false
  }, [safeIndex, setIndex])

  const canSwipe = count > 1

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!canSwipe) return
      const el = event.currentTarget
      containerWidthRef.current = el.clientWidth
      startXRef.current = event.clientX
      startYRef.current = event.clientY
      dragXRef.current = 0
      isHorizontalRef.current = false
      didSwipeRef.current = false
      draggingRef.current = true
      setIsDragging(true)
      el.setPointerCapture(event.pointerId)
    },
    [canSwipe],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!canSwipe || !draggingRef.current) return

      const dx = event.clientX - startXRef.current
      const dy = event.clientY - startYRef.current

      if (!isHorizontalRef.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalRef.current = true
        } else {
          event.currentTarget.releasePointerCapture(event.pointerId)
          draggingRef.current = false
          setIsDragging(false)
          setDragOffsetPx(0)
          return
        }
      }

      event.preventDefault()
      const atStart = safeIndex === 0 && dx > 0
      const atEnd = safeIndex === safeCount - 1 && dx < 0
      const resisted = atStart || atEnd ? dx * 0.35 : dx
      dragXRef.current = resisted
      setDragOffsetPx(resisted)
    },
    [canSwipe, safeCount, safeIndex],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!canSwipe) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (isHorizontalRef.current) {
        commitDrag()
      } else {
        draggingRef.current = false
        setIsDragging(false)
        setDragOffsetPx(0)
      }
    },
    [canSwipe, commitDrag],
  )

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!canSwipe) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      dragXRef.current = 0
      setDragOffsetPx(0)
      draggingRef.current = false
      setIsDragging(false)
      isHorizontalRef.current = false
    },
    [canSwipe],
  )

  const shouldSuppressClick = useCallback(() => {
    if (didSwipeRef.current) return true
    return Date.now() < suppressClickUntilRef.current
  }, [])

  const trackStyle: CSSProperties = {
    transform: `translateX(calc(-${safeIndex * 100}% + ${dragOffsetPx}px))`,
    transition: isDragging ? 'none' : 'transform 0.25s ease-out',
  }

  return {
    index: safeIndex,
    setIndex,
    dragOffsetPx,
    isDragging,
    canSwipe,
    trackStyle,
    shouldSuppressClick,
    pointerHandlers: canSwipe
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel,
        }
      : {},
  }
}
