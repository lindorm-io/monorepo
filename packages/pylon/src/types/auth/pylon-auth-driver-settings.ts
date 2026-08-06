import type { ReadableTime } from "@lindorm/date";
import type {
  CodeChallengeMethod,
  PromptMode,
  ResponseType,
  Scope,
  TokenEndpointAuthMethod,
} from "@lindorm/openid";

/**
 * The three client-authentication methods pylon composes itself. The IANA
 * registry is larger, but `client_secret_jwt` / `private_key_jwt` / the mTLS
 * methods need a signing key or a client certificate — a driver that wants one
 * of those attaches its own conduit middleware.
 */
export type PylonClientAuthMethod = "client_secret_basic" | "client_secret_post" | "none";

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

export type PylonOpenIdDriverSettings = PylonAuthDriverSettings & {
  /**
   * The issuer this driver reads discovery for. It must match the issuer
   * registered on `amphora.idp` — that registration is what fetched the
   * document and its keys.
   */
  issuer: string;
};

/**
 * A pure resource server never logs anyone in, so it carries no authorization
 * defaults and no PKCE. It authenticates to the introspection endpoint (RFC
 * 7662 §2.1) and reads userinfo, nothing more.
 */
export type PylonOpenIdResourceDriverSettings = {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  tokenEndpointAuthMethod?: TokenEndpointAuthMethod;
};
