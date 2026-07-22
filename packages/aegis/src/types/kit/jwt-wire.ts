import type {
  CertificateBindingMode,
  TokenSignEnvelope,
} from "../header/domain-header.js";

/**
 * Options for the TRANSFORM-FREE wire `JwtKit.sign` (R18). The kit serializes the
 * already-wire jose-keyed claim dict verbatim (modulo `omit`): no auto
 * `iat`/`jti`/`nbf`/`iss`, no hash derivation, no case/name mapping. Everything
 * domain — the envelope, the claim translation — is assembled Aegis-side before
 * the dict reaches the kit.
 */
export type SignJwtWireOptions = TokenSignEnvelope & {
  /**
   * The JOSE `typ` header PREFIX. The kit constructs the full media type from it
   * (it knows its format): `"at"` → `application/at+jwt`. An absent/empty/`null`
   * prefix floors to the bare `"JWT"`. The domain tokenType→prefix mapping is
   * Aegis-side.
   */
  typ?: string | null;
};

/**
 * Options for the wire `JwtKit.verify`. Every field is a WIRE structural knob —
 * no named domain matchers, no presence policy (those live Aegis-side).
 */
export type VerifyJwtWireOptions = {
  certBindingMode?: CertificateBindingMode;
  clockTolerance?: number;
  /**
   * Assert the header `typ` equals the media type the kit builds from this
   * PREFIX (`"at"` → `application/at+jwt`). Aegis derives the prefix from the
   * domain `tokenType`.
   */
  typ?: string;
};
