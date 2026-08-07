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
 * `endpoints` is the one exception and is REQUIRED. It is not a capability — it
 * is the IDENTITY of this relationship: pylon verifies tokens as having been
 * issued by the `issuer` it returns.
 *
 * ## ⭐ The boundary: amphora FETCHES, the driver SHAPES
 *
 * **Amphora owns every issuer and every key, and does all of its fetching at
 * ITS setup.** A driver never fetches a discovery document, never fetches a
 * JWKS, and never declares an issuer of its own — it projects what amphora
 * already holds onto {@link PylonAuthEndpoints}.
 *
 * **Which issuer scope a deployment uses is declared by WHICH DRIVER it picks**,
 * never by a duplicate issuer string in pylon config. Amphora has three scopes:
 * `amphora.internal` (this service's OWN issuer), `amphora.idp` (the single
 * upstream), and `amphora.external` (foreign issuers). `OpenIdDriver` /
 * `OpenIdResourceDriver` read the idp; `JwtDriver` pins whichever of the first
 * two the deployment names.
 *
 * ⚠ **`endpoints()` is SYNCHRONOUS, and that signature is the enforcement.** A
 * driver that cannot resolve its endpoints without awaiting something is a
 * driver doing amphora's fetching, and it will not compile. A driver that needs
 * keys from a foreign issuer registers that issuer with `amphora.external` —
 * amphora then fetches and caches it, and the driver reads it synchronously
 * like everything else.
 *
 * Drivers are not required to extend anything — this interface is the contract.
 * {@link PylonAuthDriverBase} is a convenience that implements the OAuth2
 * mechanics on top of `endpoints()`, nothing more.
 */
export interface IPylonAuthDriver {
  /**
   * The client identifier this driver presents to the provider. ⚠ The client
   * SECRET is deliberately not on the contract: it never leaves the driver.
   *
   * OPTIONAL, because a VERIFY-ONLY driver has no OAuth client: it never
   * authenticates to a token or introspection endpoint, so there is nothing to
   * be a client OF. Absent is the honest statement; an empty string would be a
   * client id that is simply wrong.
   *
   * Its only readers are the driver-response caches, which key on
   * `(issuer, clientId, token)` because RFC 7662 §2.2 lets the authorization
   * server answer the same token differently per requesting client. Those paths
   * are reached only through `introspect` / `userinfo` — methods a verify-only
   * driver does not have — so an absent `clientId` is unreachable there rather
   * than defaulted.
   */
  readonly clientId?: string;

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
   * driver projects the document amphora already fetched, a hardcoded one
   * returns a literal.
   *
   * ⚠ SYNCHRONOUS on purpose — see the boundary note on this interface. Every
   * fetch happened at `amphora.setup()`; there is nothing left here to await.
   */
  endpoints(context: PylonAuthDriverContext): PylonAuthEndpoints;

  /**
   * Build the authorization request URL. A `URL` rather than a query dict so a
   * provider needing path or fragment control is not stuck; pylon post-asserts
   * that `state` and the code challenge survived onto it.
   *
   * ⚠ Async even though pylon's own drivers only construct a URL: a custom
   * driver may need to persist per-flow state (its own PKCE record, a pushed
   * authorization request per RFC 9126) before it can name the URL. That is
   * capability the contract keeps — unlike `endpoints()`, where the async-ness
   * would only ever be amphora's work done in the wrong place.
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
   *
   * ⚠ Async for the same reason `authorize` is: pylon's own drivers only build
   * a URL, but a driver whose provider ends sessions over a back channel (a
   * revocation call, an RFC 7009 request) has real I/O to do here.
   */
  logout?(
    context: PylonAuthDriverContext,
    options: PylonAuthLogoutOptions,
  ): Promise<PylonAuthLogoutResult>;
}
