import type { CoseLabel } from "../cose/cose-label.js";
import { encodeProtectedHeader } from "../cose/structures.js";
import { coseWireKey } from "./header-registry.js";

/**
 * Build and ENCODE a COSE protected header: the parameters every write kit
 * derives — `alg` (label 1, the signing algorithm or, for a COSE_Encrypt0, the
 * content encryption), `typ` (label 16, the kit-computed media type) and `cty`
 * (label 3, the codec-inferred content type) — then the caller's already
 * translated and validated entries on top.
 *
 * `cty` is OPTIONAL: a CWT/CWM payload IS a CWT Claims Set (RFC 8392 §7.2 reads
 * it as a CBOR map with no cty-driven decode), so the claims writer derives no
 * content type at all and label 3 is simply absent unless a caller sets one.
 *
 * ⚠ ORDER IS PRECEDENCE, not layout: the caller's entries are written LAST, so a
 * caller value wins. `typ` is REFUSED to callers by `buildCoseHeaders` (it is
 * what routes a COSE token), while `cty` is settable and a caller value
 * legitimately overwrites the inferred one. The encoded BYTES are unaffected by
 * insertion order — `encodeCbor` is deterministic (CDE) and sorts the labels.
 *
 * ⚠ The unprotected bucket is written by a SEPARATE function
 * (`mergeCoseUnprotected`), and the reason is a DATA DEPENDENCY, not a
 * preference. A COSE_Encrypt0 must finalise its protected header BEFORE the AEAD
 * runs — that header IS the AAD — and the IV only exists after, so the two
 * buckets cannot be written in one pass.
 */
export const mergeCoseProtected = ({
  alg,
  typ,
  cty,
  entries,
  proprietary,
}: {
  /** The label-1 value: a COSE algorithm label, or an encryption label for CWE. */
  alg: number;
  typ: string;
  /** The label-3 value, or absent when the wire derives none. */
  cty?: string;
  entries: Map<CoseLabel, unknown>;
  /**
   * The caller's INTEROP MODE. The three derived parameters here are all
   * REGISTERED (labels 1/16/3), so it cannot change what this function writes
   * today — it is threaded so the derived parameters and the caller's entries
   * are spelled by the SAME resolver, and a derived parameter that ever landed in
   * the private-use range degrades with the rest instead of being the one
   * uninterpretable label on an interoperable token.
   */
  proprietary: boolean | undefined;
}): Buffer => {
  const map = new Map<CoseLabel, unknown>();

  map.set(coseWireKey("alg", proprietary), alg);
  map.set(coseWireKey("typ", proprietary), typ);
  if (cty !== undefined) map.set(coseWireKey("cty", proprietary), cty);

  for (const [label, value] of entries) map.set(label, value);

  return encodeProtectedHeader(map);
};
