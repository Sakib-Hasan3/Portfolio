import Image from "next/image";

/**
 * Uploaded images are resized and served as WebP by the Next.js image optimizer.
 * External URLs (e.g. Cloudinary) are left as plain <img>, since they have their own transforms.
 */
export function Photo({ src, alt, width, height, sizes, priority = false, className }: {
  src: string; alt: string; width: number; height: number; sizes?: string; priority?: boolean; className?: string;
}) {
  if (src.startsWith("/")) {
    return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} quality={78} className={className} />;
  }
  return <img src={src} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" className={className} />;
}
