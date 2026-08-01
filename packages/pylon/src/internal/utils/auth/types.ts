/**
 * The ONLY parts of the upstream IdP's OIDC discovery document pylon's relying-party
 * client reads. Amphora fetches and camelises the document but names only
 * `issuer` / `jwksUri` on its own type — these six are claimed here, at the RP
 * boundary, so a wrong name cannot slip through unnoticed again.
 *
 * Each field carries its RFC wire (snake_case) name AND its spec requirement level:
 * `getOpenIdConfiguration` is the single place the camelised document is asserted into
 * this shape, and the wire name is what a real IdP actually emits. Only the two fields
 * the specs mark REQUIRED are required here — a real OP legitimately omits the rest
 * (Auth0 publishes no `introspection_endpoint`), and every point of use handles the
 * absence explicitly rather than requesting `undefined`.
 */
export type PartialOpenIdConfiguration = {
  /** wire: `authorization_endpoint` — REQUIRED (OIDC Discovery §3, RFC 8414 §2) */
  authorizationEndpoint: string;
  /**
   * wire: `token_endpoint` — REQUIRED (OIDC Discovery §3, RFC 8414 §2), except for an
   * OP supporting only the implicit flow. Pylon's RP always exchanges a code, so it is
   * required here.
   */
  tokenEndpoint: string;
  /** wire: `userinfo_endpoint` — RECOMMENDED (OIDC Discovery §3), so it may be absent */
  userinfoEndpoint?: string;
  /** wire: `introspection_endpoint` — OPTIONAL (RFC 8414 §2, RFC 7662) */
  introspectionEndpoint?: string;
  /** wire: `end_session_endpoint` — OPTIONAL (OIDC RP-Initiated Logout 1.0 §2) */
  endSessionEndpoint?: string;
  /**
   * wire: `token_endpoint_auth_methods_supported` — OPTIONAL (OIDC Discovery §3,
   * RFC 8414 §2). When absent the spec default is `["client_secret_basic"]`.
   */
  tokenEndpointAuthMethodsSupported?: Array<string>;
};
