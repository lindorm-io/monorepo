/**
 * RFC 7636 §4.2 (PKCE) `code_challenge_method` values. A CLOSED set — the RFC
 * registers exactly these two.
 *
 * This is the OAuth WIRE vocabulary and is deliberately SEPARATE from
 * `@lindorm/pkce`'s own method enum: this package must stay dependency-light,
 * and the two are allowed to evolve independently.
 */
export const CodeChallengeMethod = {
  /** wire: `plain` — `code_challenge = code_verifier` */
  Plain: "plain",
  /** wire: `S256` — `code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))` */
  S256: "S256",
} as const;

export type CodeChallengeMethod =
  (typeof CodeChallengeMethod)[keyof typeof CodeChallengeMethod];
