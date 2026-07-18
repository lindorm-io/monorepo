import type { Dict } from "@lindorm/types";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { AegisSignKey } from "../aegis.js";
import type { SignJwtContent } from "../jwt/jwt-sign.js";

/**
 * Generic CWT content — the standard RFC 8392 claim envelope plus the shared
 * domain vocabulary, all optional. The COSE analogue of `SignJwtContent` for the
 * policy-free `cwt.sign` path: no profile floor, no auto-injection. (The
 * profile-driven CWT — access_token / id_token / … — is `mint(name, content,
 * { format: "cwt" })`, not this surface.)
 */
export type SignCwtContent<C extends Dict = Dict> = Partial<SignJwtContent<C>>;

export type SignCwtOptions = {
  /**
   * Per-call signing key policy. Resolved by `Aegis` exactly as the JWT path
   * resolves it.
   */
  key?: AegisSignKey;
  /** Envelope `iat`. Unlike a profile, the generic path never auto-injects it. */
  issuedAt?: Date;
  /** Envelope `cti`/`jti`. Never auto-generated on the generic path. */
  tokenId?: string;
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
   * COSE `typ` header (label 16). Defaults to the CWT media type derived from
   * `content.tokenType` (`application/<type>+cwt`, or `application/cwt`).
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
