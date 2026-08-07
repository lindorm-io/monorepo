import type { AegisSignKey } from "@lindorm/aegis";
import type { ReadableTime } from "@lindorm/date";
import type {
  CodeChallengeMethod,
  PromptMode,
  ResponseType,
  Scope,
  TokenEndpointAuthMethod,
} from "@lindorm/openid";

/**
 * The five client-authentication methods pylon composes itself.
 *
 * The IANA registry is larger, but the RFC 8705 mTLS methods
 * (`tls_client_auth` / `self_signed_tls_client_auth`) prove possession of a
 * CLIENT CERTIFICATE during the TLS handshake rather than by a signature, so
 * they are settled on the HTTP agent and not in a request body — a conduit
 * concern, not one this seam can compose. A driver that needs one attaches its
 * own conduit middleware.
 */
export type PylonClientAuthMethod =
  | "client_secret_basic"
  | "client_secret_jwt"
  | "client_secret_post"
  | "none"
  | "private_key_jwt";

/**
 * The RFC 7523 §2.2 client assertion — the JWT the two assertion methods send
 * as `client_assertion`.
 *
 * ⚠ Only `private_key_jwt` reads `key`. `client_secret_jwt` MACs the assertion
 * with the client secret itself, and OIDC Core §9 pins how: "The HMAC is
 * calculated using the octets of the UTF-8 representation of the client_secret
 * as the shared key." Deriving anything from it — HKDF included — would produce
 * a MAC the provider cannot reproduce, so that key is never configurable.
 */
export type PylonAuthDriverClientAssertionSettings = {
  /**
   * The assertion's lifetime. Short by design: OIDC Core §9 has these tokens
   * used ONCE, and `exp` is the only bound RFC 7523 §3 makes mandatory. Long
   * enough to absorb clock skew, short enough that a captured assertion is
   * worthless. Default `1 minute`.
   */
  expiry: ReadableTime;

  /**
   * The key `private_key_jwt` signs with — the aegis selector, so it is either
   * a key supplied outright (`{ kryptos }`) or one selected from the vault
   * (`{ condition }`; `{}` takes the deployment's default signing key). Its
   * PUBLIC half is what the client registered with the provider, so it must be
   * reachable there — pylon's own `/.well-known/jwks.json` serves that purpose
   * for a vault-resident key.
   *
   * `null` — the default — means the driver CANNOT compose `private_key_jwt`.
   * Negotiation then skips the method entirely rather than reaching for
   * whatever key the deployment happens to sign with, and pinning it throws.
   */
  key: AegisSignKey | null;
};

/**
 * The provider-side defaults for the authorization request. These are the
 * driver's, not the router's: they are what the RP asks this particular
 * provider for, and a second provider legitimately wants different ones.
 */
export type PylonAuthDriverAuthorizeSettings = {
  acrValues: string | null;
  maxAge: ReadableTime | null;
  prompt: PromptMode | null;
  /** RFC 8707 resource indicator. Auth0 renames it `audience` — see `Auth0Driver`. */
  resource: string | null;
  responseType: ResponseType;
  /**
   * The scopes this RP asks the provider for. RFC 6749 §3.3 lets every
   * deployment define its own values, so `Scope` is the autocomplete hint here,
   * not the constraint.
   */
  scope: Array<Scope | (string & {})>;
};

export type PylonAuthDriverSettings = {
  clientId: string;

  /**
   * OPTIONAL — a PUBLIC client has none. GitHub Apps, native apps and PKCE-only
   * clients authenticate with `client_id` alone (RFC 6749 §3.2.1, method `none`
   * per RFC 7591 §2), and a driver must be able to say so rather than being
   * forced to invent a secret.
   */
  clientSecret?: string;

  authorize?: Partial<PylonAuthDriverAuthorizeSettings>;

  /** RFC 7523 §2.2 — how `client_secret_jwt` / `private_key_jwt` are minted. */
  clientAssertion?: Partial<PylonAuthDriverClientAssertionSettings>;

  /**
   * The PKCE transformation pylon derives the challenge with. Defaults to
   * `S256`; `null` for a provider that rejects the parameters outright.
   */
  pkce?: CodeChallengeMethod | null;

  /**
   * Pins client authentication instead of negotiating it from provider
   * metadata. Only the methods in {@link PylonClientAuthMethod} can be composed
   * here; anything else throws at the first token request rather than silently
   * falling back to a method the provider did not advertise.
   */
  tokenEndpointAuthMethod?: TokenEndpointAuthMethod;
};

/**
 * ⚠ There is no `issuer` here. The upstream is whatever is registered on
 * `amphora.idp`, and that registration is what fetched the discovery document
 * and the keys this driver's tokens are verified against. A second issuer
 * string on pylon's side could only ever disagree with it.
 */
export type PylonOpenIdDriverSettings = PylonAuthDriverSettings;

/**
 * A pure resource server never logs anyone in, so it carries no authorization
 * defaults and no PKCE. It authenticates to the introspection endpoint (RFC
 * 7662 §2.1) and reads userinfo, nothing more. Its provider is `amphora.idp`,
 * the same as every other discovery-backed driver's.
 */
export type PylonOpenIdResourceDriverSettings = {
  clientId: string;
  clientSecret?: string;
  /**
   * RFC 7523 §2.2 — a resource server authenticates to the introspection
   * endpoint too, and RFC 8414 §2 gives that endpoint its own advertised
   * methods, so it needs the same assertion knobs a relying party does.
   */
  clientAssertion?: Partial<PylonAuthDriverClientAssertionSettings>;
  tokenEndpointAuthMethod?: TokenEndpointAuthMethod;
};

/**
 * Which of amphora's issuer scopes {@link JwtDriver} pins.
 *
 * ⚠ REQUIRED, with no default. A service can legitimately hold BOTH — an OIDC
 * provider that mints its own tokens AND federates to an upstream — so which
 * one a deployment verifies against is a fact only the deployment knows. A
 * default here would silently pick one of two live issuers.
 */
export type PylonJwtDriverIssuer = "self" | "idp";

/**
 * A verify-only driver's whole configuration: which issuer, and nothing else.
 * No client id, no secret, no endpoints — it never talks to anyone.
 */
export type PylonJwtDriverSettings = {
  /**
   * `"self"` — this service IS the issuer (`amphora.internal`). `"idp"` — the
   * single upstream registered on `amphora.idp`.
   */
  issuer: PylonJwtDriverIssuer;
};
