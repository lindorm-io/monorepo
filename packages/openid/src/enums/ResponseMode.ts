/**
 * OAuth 2.0 `response_mode` values.
 *
 * OAuth 2.0 Multiple Response Type Encoding Practices §2.1 (query / fragment)
 * + OAuth 2.0 Form Post Response Mode (form_post) + JARM (JWT Secured
 * Authorization Response Mode for OAuth 2.0) §2.3, which adds the `.jwt`
 * variants. JARM §4 defines the matching provider metadata — see
 * `OpenIdConfiguration`.
 *
 * The type is CLOSED — exactly the modes listed here. The IANA response mode
 * registry is extensible, but a deployment accepting an unlisted mode widens
 * in its OWN package.
 */
export const ResponseMode = {
  /** wire: `form_post` — OAuth 2.0 Form Post Response Mode §2 */
  FormPost: "form_post",
  /** wire: `form_post.jwt` — JARM §2.3.3 */
  FormPostJwt: "form_post.jwt",
  /** wire: `fragment` — Multiple Response Type Encoding Practices §2.1 */
  Fragment: "fragment",
  /** wire: `fragment.jwt` — JARM §2.3.2 */
  FragmentJwt: "fragment.jwt",
  /** wire: `query` — Multiple Response Type Encoding Practices §2.1 */
  Query: "query",
  /** wire: `query.jwt` — JARM §2.3.1 */
  QueryJwt: "query.jwt",
  /** wire: `jwt` — JARM §2.3.4, shorthand resolving to the response type default */
  Jwt: "jwt",
} as const;

export type ResponseMode = (typeof ResponseMode)[keyof typeof ResponseMode];
