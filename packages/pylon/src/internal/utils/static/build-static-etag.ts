import type { StaticEncoding } from "./select-static-variant.js";

// Weak validator from size + mtime, with the encoding folded in so that the
// identity and precompressed representations never share an ETag:
// `W/"<size hex>-<mtimeMs hex>[-br|-gz]"`.
export const buildStaticEtag = (
  size: number,
  mtimeMs: number,
  encoding: StaticEncoding | null,
): string => {
  const suffix = encoding === "br" ? "-br" : encoding === "gzip" ? "-gz" : "";

  return `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}${suffix}"`;
};
