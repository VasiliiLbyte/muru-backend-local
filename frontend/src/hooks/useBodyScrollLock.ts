import { useEffect, useRef } from 'react'

export const useBodyScrollLock = (locked: boolean) => {
  const previousOverflowRef = useRef<string | null>(null)

  useEffect(() => {
    if (!locked) return

    previousOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflowRef.current ?? ''
      previousOverflowRef.current = null
    }
  }, [locked])
}
