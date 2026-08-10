import type { KryptosAlgorithm } from "@lindorm/kryptos";

/**
 * The per-call knobs for `Aegis.assert` / `Aegis.matches`. The matcher itself is
 * the positional {@link import("./domain-assert.js").DomainAssert} argument, so
 * `assert` is "verify's claim checking, without the signature" — that one
 * sentence explains every difference from {@link
 * import("./verify.js").VerifyOptions}.
 *
 * Verify has a KEY, so it checks a signature, derives `algorithm` from the key,
 * and enforces the structural/presence policy the wire imposes. Assert has
 * neither a key nor a wire — only claims — so it keeps the knobs that apply to
 * claims alone: the derivation input, and the temporal window.
 */
export type AssertOptions = {
  /**
   * The token's signing algorithm — the hash-derive matchers
   * (`accessToken`/`authCode`/`authState`) hash their raw source with it (OIDC
   * Core §3.1.3.6 ties the digest to `alg`). Required only when one of them is
   * used; `verify` takes it from the verifying key, and this surface has no key
   * to take it from.
   */
  algorithm?: KryptosAlgorithm;
  /**
   * Widen every temporal range check by this many seconds in both directions,
   * to absorb clock skew. Default `0` — the same default `aegis.verify` runs
   * with, so the two agree unless told otherwise.
   */
  clockTolerance?: number;
  /** Override "now" for the temporal range checks. */
  currentDate?: Date;
  /**
   * Reject claims whose `issuedAt` is older than this many seconds. Adds an
   * `issuedAt >= now - maxTokenAge` lower bound (with clock tolerance) and
   * requires the claim to be present. Independent of {@link verifyIssuedAt}.
   */
  maxTokenAge?: number;
  /** Range-check `expiresAt`. Default `true`. `false` ⇒ EXPIRED claims pass. */
  verifyExpiration?: boolean;
  /** Range-check `notBefore`. Default `true`. */
  verifyNotBefore?: boolean;
  /** Range-check `issuedAt`. Default `true`. */
  verifyIssuedAt?: boolean;
  /** Range-check `authTime`. Default `true`. */
  verifyAuthTime?: boolean;
};
