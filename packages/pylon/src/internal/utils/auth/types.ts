/**
 * The ONLY parts of the upstream IdP's OIDC discovery document pylon's relying-party
 * client reads. Amphora fetches and camelises the document but names only
 * `issuer` / `jwksUri` on its own type — these six are claimed here, at the RP
 * boundary, so a wrong name cannot slip through unnoticed again.
 *
 * Each field carries its RFC wire (snake_case) name: `getOpenIdConfiguration` is the
 * single place the camelised document is asserted into this shape, and the wire name
 * is what a real IdP actually emits.
 */
export type PartialOpenIdConfiguration = {
  /** wire: `authorization_endpoint` */
  authorizationEndpoint: string;
  /** wire: `token_endpoint` */
  tokenEndpoint: string;
  /** wire: `userinfo_endpoint` */
  userinfoEndpoint: string;
  /** wire: `introspection_endpoint` (RFC 7662) */
  introspectionEndpoint: string;
  /** wire: `end_session_endpoint` (OIDC RP-Initiated Logout) */
  endSessionEndpoint: string;
  /** wire: `token_endpoint_auth_methods_supported` */
  tokenEndpointAuthMethodsSupported: Array<string>;
};
