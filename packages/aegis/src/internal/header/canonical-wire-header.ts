import type { Dict } from "@lindorm/types";

/**
 * Put a JOSE-named header bag into its CANONICAL on-wire key order — alphabetical
 * by JOSE parameter name.
 *
 * The signed header BYTES are the base64url of this object's JSON, and
 * `JSON.stringify` emits keys in insertion order, so the order is part of the
 * artifact: two headers carrying the same parameters must serialise identically
 * whether a parameter arrived from the kit or from the caller's bag. Every
 * producer of a wire header therefore ends on this pass — `mapTokenHeader` for the
 * domain crossing, `buildJoseHeader` for the assembled JOSE header — rather than
 * each sorting its own way.
 */
export const canonicalWireHeader = <T extends Dict>(header: T): T => {
  const sorted: Dict = {};

  for (const key of Object.keys(header).sort()) {
    sorted[key] = header[key];
  }

  return sorted as T;
};
