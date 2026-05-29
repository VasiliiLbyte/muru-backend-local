import { useMemo, useState } from 'react'

import {
  buildImageCandidates,
  buildImageSrcSet,
  extractDriveFileId,
} from '../lib/images'

type SmartImageProps = {
  src?: string | null
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
}

const SmartImageInner = ({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 50vw, 320px',
  priority = false,
}: SmartImageProps) => {
  const candidates = useMemo(() => buildImageCandidates(src), [src])
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  const fileId = useMemo(() => (src?.trim() ? extractDriveFileId(src.trim()) : null), [src])

  const currentSrc = candidates[Math.min(candidateIndex, candidates.length - 1)]
  const srcSet = candidateIndex === 0 && fileId ? buildImageSrcSet(src) : undefined
  const useSrcSet = Boolean(srcSet) && !errored

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && !errored ? (
        <div className="absolute inset-0 animate-pulse bg-[#efe8d8]" />
      ) : null}
      <img
        src={currentSrc}
        srcSet={useSrcSet ? srcSet : undefined}
        sizes={useSrcSet ? sizes : undefined}
        alt={alt}
        className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.03]'}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (candidateIndex < candidates.length - 1) {
            setCandidateIndex((prev) => prev + 1)
            setLoaded(false)
            return
          }
          setErrored(true)
        }}
      />
    </div>
  )
}

/** Remount when `src` changes so fallback index resets without a setState-in-effect pattern. */
export const SmartImage = (props: SmartImageProps) => {
  return <SmartImageInner key={props.src ?? ''} {...props} />
}
