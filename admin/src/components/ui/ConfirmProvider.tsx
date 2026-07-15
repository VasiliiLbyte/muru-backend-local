import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

type PendingConfirm = {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const queueRef = useRef<PendingConfirm[]>([])
  const pendingRef = useRef<PendingConfirm | null>(null)

  const showNext = useCallback(() => {
    if (pendingRef.current) return
    const next = queueRef.current.shift()
    if (!next) return
    pendingRef.current = next
    setPending(next)
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        queueRef.current.push({ options, resolve })
        showNext()
      }),
    [showNext],
  )

  const close = useCallback(
    (result: boolean) => {
      const current = pendingRef.current
      if (!current) return
      current.resolve(result)
      pendingRef.current = null
      setPending(null)
      setTimeout(showNext, 0)
    },
    [showNext],
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(pending)}
        options={pending?.options ?? null}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  )
}

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
