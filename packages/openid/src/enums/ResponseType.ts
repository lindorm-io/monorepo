/**
 * OAuth 2.0 / OIDC `response_type` values.
 *
 * OIDC Core §3 (code / id_token / id_token token / code id_token /
 * code token / code id_token token) + RFC 6749 §3.1.1 (code / token) +
 * OAuth 2.0 Multiple Response Type Encoding Practices §4 (`none`).
 *
 * The type stays OPEN — RFC 6749 §8.4 allows extension response types.
 */
export const ResponseType = {
  /** wire: `code` — RFC 6749 §4.1 authorization code flow */
  Code: "code",
  /** wire: `token` — RFC 6749 §4.2 implicit flow */
  Token: "token",
  /** wire: `id_token` — OIDC Core §3.2 implicit flow */
  IdToken: "id_token",
  /** wire: `code id_token` — OIDC Core §3.3 hybrid flow */
  CodeIdToken: "code id_token",
  /** wire: `code token` — OIDC Core §3.3 hybrid flow */
  CodeToken: "code token",
  /** wire: `id_token token` — OIDC Core §3.2 implicit flow */
  IdTokenToken: "id_token token",
  /** wire: `code id_token token` — OIDC Core §3.3 hybrid flow */
  CodeIdTokenToken: "code id_token token",
  /** wire: `none` — OAuth 2.0 Multiple Response Type Encoding Practices §4 */
  None: "none",
} as const;

export type ResponseType =
  | (typeof ResponseType)[keyof typeof ResponseType]
  | (string & {});
