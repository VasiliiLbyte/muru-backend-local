import type { TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = ({ className, ...props }: TextareaProps) => (
  <textarea className={cn('muru-textarea', className)} {...props} />
)
