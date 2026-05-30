import ReactMarkdown from 'react-markdown'

import termsMd from '../content/legal/terms.md?raw'
import privacyMd from '../content/legal/privacy.md?raw'
import { pressable } from '../lib/uiClasses'

type LegalDoc = 'terms' | 'privacy'

const DOCS: Record<LegalDoc, { title: string; body: string }> = {
  terms: { title: 'Пользовательское соглашение', body: termsMd },
  privacy: { title: 'Политика обработки персональных данных', body: privacyMd },
}

export function LegalPage({ doc, onBack }: { doc: LegalDoc; onBack: () => void }) {
  const { title, body } = DOCS[doc]
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className={`${pressable} inline-flex items-center gap-1 text-sm text-muru-olive`}
      >
        ← Назад
      </button>
      <article className="rounded-2xl bg-[#fffaf3] p-5 shadow-[0_2px_10px_rgba(60,55,40,0.05)]">
        <h1 className="font-muru-display text-[1.7rem] font-medium leading-tight text-muru-olive">
          {title}
        </h1>
        <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-muru-text">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h2 className="font-muru-display text-xl font-medium text-muru-olive mt-5">
                  {children}
                </h2>
              ),
              h2: ({ children }) => (
                <h3 className="mt-5 text-sm font-medium uppercase tracking-wide text-muru-olive">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="text-[14px] leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
              li: ({ children }) => <li className="text-[14px] leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-medium text-muru-text">{children}</strong>,
              a: ({ children, href }) => (
                <a href={href} className="text-muru-olive underline">
                  {children}
                </a>
              ),
              hr: () => <hr className="my-4 border-muru-accent/30" />,
              blockquote: ({ children }) => (
                <blockquote className="rounded-lg bg-[#efe8d8]/60 p-3 text-xs text-[#6f6666]">
                  {children}
                </blockquote>
              ),
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      </article>
    </section>
  )
}
