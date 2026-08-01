/**
 * OAuth 2.0 `response_mode` values.
 *
 * OAuth 2.0 Multiple Response Type Encoding Practices §2.1 (query / fragment)
 * + OAuth 2.0 Form Post Response Mode (form_post) + JARM (OpenID
 * Financial-grade API — JWT Secured Authorization Response Mode) §2, which
 * adds the `.jwt` variants.
 *
 * The type stays OPEN — the response mode registry is extensible.
 */
export const ResponseMode = {
  /** wire: `form_post` — OAuth 2.0 Form Post Response Mode §2 */
  FormPost: "form_post",
  /** wire: `form_post.jwt` — JARM §2.3 */
  FormPostJwt: "form_post.jwt",
  /** wire: `fragment` — Multiple Response Type Encoding Practices §2.1 */
  Fragment: "fragment",
  /** wire: `fragment.jwt` — JARM §2.2 */
  FragmentJwt: "fragment.jwt",
  /** wire: `query` — Multiple Response Type Encoding Practices §2.1 */
  Query: "query",
  /** wire: `query.jwt` — JARM §2.1 */
  QueryJwt: "query.jwt",
  /** wire: `jwt` — JARM §2.4, shorthand resolving to the response type default */
  Jwt: "jwt",
} as const;

export type ResponseMode =
  | (typeof ResponseMode)[keyof typeof ResponseMode]
  | (string & {});
