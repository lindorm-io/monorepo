import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { AegisSignKey } from "../aegis.js";

/**
 * Options for the raw wire CWT sign namespaces (`aegis.cwt.sign` /
 * `aegis.cwm.sign`). The consumer hands ALREADY-WIRE `CwtWireClaims`
 * (COSE-name-keyed: `iss`/`sub`/`exp`/`cti`), so these are pure wire knobs — no
 * envelope, no auto-injection, no domain translation. The kit serializes the
 * claims verbatim (modulo `omit`); the domain sign path is `aegis.mint`.
 */
export type SignCwtOptions = {
  /**
   * Per-call signing key policy. Resolved by `Aegis` exactly as the JWT path
   * resolves it.
   */
  key?: AegisSignKey;
  /** Carried onto the `SignedCwt` result for the caller's convenience; not a claim. */
  objectId?: string;
  /**
   * How empty claims are pruned before the CBOR is emitted. `"empty"` (default)
   * drops null/empty-string/empty-array/empty-object recursively; `"undefined"`
   * drops only undefined.
   */
  omit?: OmitMode;
  /**
   * Use compact private-use integer COSE labels (default `true`). Set `false`
   * for off-platform tokens — long claims degrade to their JOSE string key
   * (interoperable, never dropped). See `encodeCwtClaims`.
   */
  proprietary?: boolean;
  /**
   * The full COSE `typ` media type (label 16), e.g. `application/at+cwt`. Handed
   * to the kit verbatim — the raw namespace knows nothing of domain token types.
   */
  typ?: string;
};

export type SignedCwt = {
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  expiresOn: number | undefined;
  objectId: string | undefined;
  token: string;
  tokenId: string | undefined;
};
