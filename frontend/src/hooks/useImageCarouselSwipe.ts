import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'

const SWIPE_THRESHOLD_PX = 40
const SUPPRESS_CLICK_MS = 300
const GESTURE_START_PX = 6

type UseImageCarouselSwipeOptions = {
  count: number
  onIndexChange?: (index: number) => void
  viewportRef?: RefObject<HTMLElement | null>
}

export const useImageCarouselSwipe = ({ count, onIndexChange, viewportRef }: UseImageCarouselSwipeOptions) => {
  const [index, setIndexState] = useState(0)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)
  const draggingRef = useRef(false)

  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const dragXRef = useRef(0)
  const isHorizontalRef = useRef(false)
  const didSwipeRef = useRef(false)
  const suppressClickUntilRef = useRef(0)

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

  const endInteraction = useCallback(() => {
    draggingRef.current = false
    setIsDragging(false)
    setIsInteracting(false)
    isHorizontalRef.current = false
  }, [])

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
    endInteraction()
  }, [endInteraction, safeIndex, setIndex])

  const canSwipe = count > 1

  const applyDrag = useCallback(
    (dx: number) => {
      const atStart = safeIndex === 0 && dx > 0
      const atEnd = safeIndex === safeCount - 1 && dx < 0
      const resisted = atStart || atEnd ? dx * 0.35 : dx
      dragXRef.current = resisted
      setDragOffsetPx(resisted)
    },
    [safeCount, safeIndex],
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!canSwipe) return
      const el = event.currentTarget
      startXRef.current = event.clientX
      startYRef.current = event.clientY
      dragXRef.current = 0
      isHorizontalRef.current = false
      didSwipeRef.current = false
      draggingRef.current = true
      setIsDragging(true)
      setIsInteracting(true)
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
        if (Math.hypot(dx, dy) < GESTURE_START_PX) return
        isHorizontalRef.current = true
      }

      event.preventDefault()
      applyDrag(dx)
    },
    [applyDrag, canSwipe],
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
        dragXRef.current = 0
        setDragOffsetPx(0)
        endInteraction()
      }
    },
    [canSwipe, commitDrag, endInteraction],
  )

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!canSwipe) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      dragXRef.current = 0
      setDragOffsetPx(0)
      endInteraction()
    },
    [canSwipe, endInteraction],
  )

  useEffect(() => {
    const el = viewportRef?.current
    if (!el || !canSwipe) return

    const onTouchMove = (event: TouchEvent) => {
      if (!draggingRef.current) return
      event.preventDefault()
    }

    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [canSwipe, viewportRef])

  const shouldSuppressClick = useCallback(() => {
    if (didSwipeRef.current) return true
    return Date.now() < suppressClickUntilRef.current
  }, [])

  const slideShiftPercent = safeCount > 0 ? (safeIndex * 100) / safeCount : 0

  const trackStyle: CSSProperties = {
    transform: `translateX(calc(-${slideShiftPercent}% + ${dragOffsetPx}px))`,
    transition: isDragging ? 'none' : 'transform 0.25s ease-out',
  }

  return {
    index: safeIndex,
    setIndex,
    dragOffsetPx,
    isDragging,
    isInteracting,
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
