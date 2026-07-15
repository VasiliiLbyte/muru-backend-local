import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { PromptDialog, type PromptOptions } from './PromptDialog'

type PromptFn = (options: PromptOptions) => Promise<string | null>

const PromptContext = createContext<PromptFn | null>(null)

type PendingPrompt = {
  options: PromptOptions
  resolve: (value: string | null) => void
}

export const PromptProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const queueRef = useRef<PendingPrompt[]>([])
  const pendingRef = useRef<PendingPrompt | null>(null)

  const showNext = useCallback(() => {
    if (pendingRef.current) return
    const next = queueRef.current.shift()
    if (!next) return
    pendingRef.current = next
    setPending(next)
  }, [])

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        queueRef.current.push({ options, resolve })
        showNext()
      }),
    [showNext],
  )

  const close = useCallback(
    (result: string | null) => {
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
    <PromptContext.Provider value={prompt}>
      {children}
      <PromptDialog
        open={Boolean(pending)}
        options={pending?.options ?? null}
        onConfirm={(value) => close(value)}
        onCancel={() => close(null)}
      />
    </PromptContext.Provider>
  )
}

export const usePrompt = (): PromptFn => {
  const ctx = useContext(PromptContext)
  if (!ctx) throw new Error('usePrompt must be used within PromptProvider')
  return ctx
}
