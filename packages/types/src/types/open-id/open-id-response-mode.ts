// OAuth 2.0 Multiple Response Type Encoding Practices + JARM (OpenID
// Financial-grade API §5.1) — JARM adds the *.jwt variants.
export type OpenIdResponseMode =
  | "form_post"
  | "form_post.jwt"
  | "fragment"
  | "fragment.jwt"
  | "query"
  | "query.jwt"
  | "jwt"
  | (string & {});
