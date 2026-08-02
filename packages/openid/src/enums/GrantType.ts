/**
 * OAuth 2.x / OpenID Connect grant types.
 *
 * The runtime object is the SINGLE SOURCE — the type is derived from it, so a
 * value and its type can never drift apart. Consumable at runtime (e.g. a
 * proteus `@Enum` column) as well as in type position.
 *
 * The type is CLOSED — exactly the grant types listed here. RFC 6749 §8.3
 * allows extension and vendor grant types, but a deployment accepting one
 * widens in its OWN package (`GrantType | "urn:acme:grant"`), so the hole is
 * visible where it is taken.
 */
export const GrantType = {
  /** wire: `authorization_code` — RFC 6749 §4.1 */
  AuthorizationCode: "authorization_code",
  /** wire: `client_credentials` — RFC 6749 §4.4 */
  ClientCredentials: "client_credentials",
  /** wire: `password` — RFC 6749 §4.3 */
  Password: "password",
  /** wire: `refresh_token` — RFC 6749 §6 */
  RefreshToken: "refresh_token",

  /** wire: `urn:ietf:params:oauth:grant-type:device_code` — RFC 8628 §3.4 */
  DeviceCode: "urn:ietf:params:oauth:grant-type:device_code",
  /** wire: `urn:ietf:params:oauth:grant-type:token-exchange` — RFC 8693 §2.1 */
  TokenExchange: "urn:ietf:params:oauth:grant-type:token-exchange",
  /** wire: `urn:ietf:params:oauth:grant-type:jwt-bearer` — RFC 7523 §2.1 */
  JwtBearer: "urn:ietf:params:oauth:grant-type:jwt-bearer",
  /** wire: `urn:ietf:params:oauth:grant-type:saml2-bearer` — RFC 7522 §2.1 */
  Saml2Bearer: "urn:ietf:params:oauth:grant-type:saml2-bearer",
  /** wire: `urn:openid:params:grant-type:ciba` — OpenID CIBA Core 1.0 §11 */
  Ciba: "urn:openid:params:grant-type:ciba",
} as const;

export type GrantType = (typeof GrantType)[keyof typeof GrantType];
