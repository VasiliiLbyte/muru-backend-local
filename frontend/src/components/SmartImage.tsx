import { useEffect, useMemo, useState } from 'react'

import { buildImageCandidates } from '../lib/images'

type SmartImageProps = {
  src?: string | null
  alt: string
  className?: string
}

export const SmartImage = ({ src, alt, className }: SmartImageProps) => {
  const candidates = useMemo(() => buildImageCandidates(src), [src])
  const [candidateIndex, setCandidateIndex] = useState(0)

  useEffect(() => {
    setCandidateIndex(0)
  }, [src])

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
