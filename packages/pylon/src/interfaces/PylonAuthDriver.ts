import type { CodeChallengeMethod } from "@lindorm/openid";
import type {
  PylonAuthAuthorizeOptions,
  PylonAuthClientCredentialsOptions,
  PylonAuthDriverContext,
  PylonAuthEndpoints,
  PylonAuthExchangeOptions,
  PylonAuthIntrospectOptions,
  PylonAuthLogoutOptions,
  PylonAuthLogoutResult,
  PylonAuthRefreshOptions,
  PylonAuthSubjectOptions,
  PylonAuthTokenResult,
  PylonAuthUserinfoOptions,
  PylonIntrospection,
  PylonUserinfo,
} from "../types/index.js";

/**
 * The published contract between pylon and an identity provider.
 *
 * ⚠ EVERY CAPABILITY METHOD IS OPTIONAL, AND AN OMITTED METHOD IS THE
 * CAPABILITY DECLARATION. There is no flags bag that can disagree with reality:
 * a driver for a provider with no refresh grant (GitHub classic tokens never
 * expire and cannot be refreshed) simply does not write `refresh`, and pylon
 * checks `if (!driver.refresh)` at boot and fails with a real message instead of
 * silently never refreshing. Methods that throw `NOT_IMPLEMENTED` would defeat
 * this — every driver would then *have* every method.
 *
 * `endpoints` is the one exception and is REQUIRED. It is not a capability but
 * the provider's identity: pylon verifies id_tokens against the `issuer` and
 * `jwksUri` it returns, and there is no fallback for a driver that cannot say
 * who its provider is.
 *
 * Drivers are not required to extend anything — this interface is the contract.
 * {@link PylonAuthDriverBase} is a convenience that implements the OAuth2
 * mechanics on top of `endpoints()`, nothing more.
 */
export interface IPylonAuthDriver {
  /**
   * The PKCE transformation pylon derives the challenge with (RFC 7636 §4.2),
   * or `null` for a provider that rejects the parameters. Absent ⇒ pylon's
   * default, `S256`.
   *
   * Pylon generates and stores the verifier — the driver only says which
   * transformation its provider understands.
   */
  readonly pkce?: CodeChallengeMethod | null;

  /**
   * The provider's endpoint surface. Called per request; a discovery-backed
   * driver reads the cached document, a hardcoded one returns a literal.
   */
  endpoints(context: PylonAuthDriverContext): Promise<PylonAuthEndpoints>;

  /**
   * Build the authorization request URL. A `URL` rather than a query dict so a
   * provider needing path or fragment control is not stuck; pylon post-asserts
   * that `state` and the code challenge survived onto it.
   */
  authorize?(
    context: PylonAuthDriverContext,
    options: PylonAuthAuthorizeOptions,
  ): Promise<URL>;

  /** RFC 6749 §4.1.3 — exchange the authorization code for tokens. */
  exchange?(
    context: PylonAuthDriverContext,
    options: PylonAuthExchangeOptions,
  ): Promise<PylonAuthTokenResult>;

  /** RFC 6749 §6 — refresh the access token. */
  refresh?(
    context: PylonAuthDriverContext,
    options: PylonAuthRefreshOptions,
  ): Promise<PylonAuthTokenResult>;

  /** RFC 6749 §4.4 — the client credentials grant. Just another grant; the
   * driver owns ALL token-endpoint traffic. */
  clientCredentials?(
    context: PylonAuthDriverContext,
    options: PylonAuthClientCredentialsOptions,
  ): Promise<PylonAuthTokenResult>;

  /** RFC 7662 — introspect a token presented to this service. */
  introspect?(
    context: PylonAuthDriverContext,
    options: PylonAuthIntrospectOptions,
  ): Promise<PylonIntrospection>;

  /** OIDC Core §5.3 — fetch and normalise the subject's profile. */
  userinfo?(
    context: PylonAuthDriverContext,
    options: PylonAuthUserinfoOptions,
  ): Promise<PylonUserinfo>;

  /**
   * Resolve the subject behind an OPAQUE access token, or `null` when it cannot
   * be established. This is what lets a provider with no id_token (GitHub,
   * Discord) complete a login at all.
   */
  subject?(
    context: PylonAuthDriverContext,
    options: PylonAuthSubjectOptions,
  ): Promise<string | null>;

  /**
   * End the session at the provider. Returns `redirect` with the URL to send the
   * browser to, or `local` when the provider has nothing to redirect to and the
   * session should simply be dropped (having been revoked server-side or not at
   * all).
   */
  logout?(
    context: PylonAuthDriverContext,
    options: PylonAuthLogoutOptions,
  ): Promise<PylonAuthLogoutResult>;
}
