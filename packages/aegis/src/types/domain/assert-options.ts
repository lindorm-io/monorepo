/**
 * The per-call knobs for the claim check — `aegis.assert` / `aegis.matches` and
 * `assertClaims` / `claimsMatch`. The matcher itself is the positional
 * {@link import("./domain-assert.js").DomainAssert} argument, so
 * `assert` is "verify's claim checking, without the signature" — that one
 * sentence explains every difference from {@link
 * import("./verify.js").VerifyOptions}.
 *
 * Verify has a KEY, so it checks a signature and enforces the structural /
 * presence policy the wire imposes. Assert has neither a key nor a wire — only
 * claims — so what remains is the TEMPORAL FAMILY, and nothing else: the window
 * every range check runs in.
 */
export type AssertOptions = {
  /**
   * Widen every temporal range check by this many seconds in both directions,
   * to absorb clock skew. Unstated, `assertClaims` / `claimsMatch` allow `0`,
   * and `aegis.assert` / `aegis.matches` allow the deployment's
   * `clockTolerance` — the window `aegis.verify` runs in.
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
  /**
   * Range-check `authTime`. Default `true`: an `authTime` later than now is
   * refused — an upper bound like `issuedAt`, never a freshness bound. Aegis
   * policy, not an OpenID Connect Core requirement.
   */
  verifyAuthTime?: boolean;
};
