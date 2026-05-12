import { useMemo, useState } from 'react'

import { buildImageCandidates } from '../lib/images'

type SmartImageProps = {
  src?: string | null
  alt: string
  className?: string
}

const SmartImageInner = ({ src, alt, className }: SmartImageProps) => {
  const candidates = useMemo(() => buildImageCandidates(src), [src])
  const [candidateIndex, setCandidateIndex] = useState(0)

  const currentSrc = candidates[Math.min(candidateIndex, candidates.length - 1)]

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        setCandidateIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : prev))
      }}
    />
  )
}

/** Remount when `src` changes so fallback index resets without a setState-in-effect pattern. */
export const SmartImage = (props: SmartImageProps) => {
  return <SmartImageInner key={props.src ?? ''} {...props} />
}
