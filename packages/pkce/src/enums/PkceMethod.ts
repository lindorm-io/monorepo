/**
 * The transformation applied to the verifier to derive the challenge —
 * RFC 7636 §4.2. A CLOSED set: the RFC registers exactly these two, and this
 * package implements exactly these two.
 *
 * The runtime object is the SINGLE SOURCE — the type is derived from it, so a
 * value and its type can never drift apart.
 *
 * This is the PKCE LIBRARY's own vocabulary. `@lindorm/openid` carries a
 * separate `CodeChallengeMethod` for the OAuth `code_challenge_method` WIRE
 * parameter; the two hold the same values today but are deliberately kept
 * apart, so neither package has to depend on the other and each may evolve on
 * its own terms.
 */
export const PkceMethod = {
  /** `challenge = verifier` */
  Plain: "plain",
  /** `challenge = BASE64URL(SHA256(ASCII(verifier)))` */
  S256: "S256",
} as const;

export type PkceMethod = (typeof PkceMethod)[keyof typeof PkceMethod];
