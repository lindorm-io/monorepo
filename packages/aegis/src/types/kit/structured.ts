import type { Dict, TokenData } from "@lindorm/types";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { CertificateBindingMode } from "../header/domain-header.js";
import type { WireTokenEnvelope } from "../header/wire-envelope.js";
import type { WireTokenHeader } from "../header/wire-header.js";

/**
 * The STRUCTURED (claims-bearing) sign options — shared by JWT, CWT, CWM. The
 * wire envelope plus `omit` (empty-claim pruning, structured-only). The claims
 * dict is the positional argument (`JwtClaimsWire & C` for JWT, `CwtClaimsWire &
 * C` for CWT/CWM); these options are pure wire knobs, format-parallel.
 */
export type SignStructuredTokenOptions = WireTokenEnvelope & {
  /**
   * How empty claims are pruned before serialisation. `"empty"` (default) drops
   * null/empty-string/empty-array/empty-object recursively; `"undefined"` drops
   * only undefined.
   */
  omit?: OmitMode;
};

/**
 * The STRUCTURED verify options — shared by JWT, CWT, CWM. Pure wire structural
 * knobs; no named domain matchers, no presence policy (those live Aegis-side).
 * `certBindingMode` is a JOSE-only knob (COSE ignores it); `tokenType` is the
 * bare PREFIX the kit re-wraps into the expected media type.
 */
export type VerifyStructuredTokenOptions = {
  certBindingMode?: CertificateBindingMode;
  clockTolerance?: number;
  /**
   * Override "now" for the temporal range checks (R10). When set, `exp`/`nbf`/
   * `iat` are validated against this instant instead of the real wall-clock.
   * Per-call only.
   */
  currentDate?: Date;
  /**
   * Reject a token whose `iat` is older than this many seconds (R10). Adds an
   * `iat >= now - maxTokenAge` lower bound (with clock tolerance) and requires
   * `iat` to be present. Per-call only. Independent of {@link verifyIssuedAt}.
   */
  maxTokenAge?: number;
  /**
   * Range-check `exp`. Default `true`. `false` ⇒ the `exp` range bound is
   * skipped, so an EXPIRED token verifies. Presence is a domain concern and is
   * not affected here.
   */
  verifyExpiration?: boolean;
  /** Range-check `nbf`. Default `true`. `false` ⇒ the `nbf` bound is skipped. */
  verifyNotBefore?: boolean;
  /** Range-check `iat`. Default `true`. `false` ⇒ the `iat` upper bound is skipped. */
  verifyIssuedAt?: boolean;
  /** Range-check `auth_time`. Default `true`. `false` ⇒ the `auth_time` bound is skipped. */
  verifyAuthTime?: boolean;
  /**
   * Assert the header `typ` equals the media type the kit builds from this bare
   * PREFIX (`"at"` → `application/at+jwt` / `application/at+cwt`). Aegis derives
   * the prefix from the domain `tokenType`.
   */
  tokenType?: string;
};

/**
 * The NATIVE WIRE result of verifying a STRUCTURED token (`JwtKit`/`CwtKit`/
 * `CwmKit` verify). Carries the WIRE-keyed `payload` (`sub`/`exp`/`jti`|`cti`,
 * never the domain `subject`/`expiresAt`/`tokenId`), the unified WIRE header
 * ({@link WireTokenHeader} — identical in TYPE across JOSE and COSE), and the
 * NATIVE token (`string` JOSE / `Buffer` COSE). The domain claim + header
 * translation is Aegis-side (`aegis.verify` → `VerifiedToken`).
 */
export type VerifiedStructuredToken<
  C extends Dict = Dict,
  T extends TokenData = Buffer,
> = {
  header: WireTokenHeader;
  payload: C;
  token: T;
};

/**
 * The uniform `decode` result for a STRUCTURED token — JWT ≡ CWT ≡ CWM: the
 * unified WIRE header + cleartext WIRE claims, NO signature/MAC verification.
 */
export type DecodedStructuredToken<
  C extends Dict = Dict,
  T extends TokenData = Buffer,
> = {
  header: WireTokenHeader;
  payload: C;
  signature: T;
  token: T;
};
