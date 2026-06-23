'use client'

import Image, { type ImageProps } from 'next/image'
import type { ImageAlt } from '../types.js'

type SeolfulImageProps = ImageProps & {
  seolfulAlts?: ImageAlt[]
}

export function SeolfulImage({ src, seolfulAlts, alt, ...props }: SeolfulImageProps) {
  const resolved = seolfulAlts?.find((a) => a.src === String(src))?.alt ?? alt
  return <Image src={src} alt={resolved ?? ''} {...props} />
}
