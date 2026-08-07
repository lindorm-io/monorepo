import type {
  AuthorizeRequestQuery,
  CodeChallengeMethod,
  LogoutRequest,
  ResponseType,
} from "@lindorm/openid";
import type { PylonAuthLogoutResult } from "../auth/pylon-auth-driver-options.js";
import type { PylonAuthCacheEntry } from "../settings/auth-settings.js";
import type { PylonIntrospection } from "./pylon-introspection.js";
import type { PylonUserinfo } from "./pylon-userinfo.js";

export type AuthorizeQuery = Partial<
  Omit<
    AuthorizeRequestQuery,
    | "clientId"
    | "codeChallenge"
    | "codeChallengeMethod"
    | "nonce"
    | "redirectUri"
    | "responseMode"
    | "responseType"
    | "state"
  >
>;

export type AuthorizeResult = {
  /**
   * The callback URI pylon put on the authorization request. Carried into the
   * login cookie and replayed verbatim to the code exchange — RFC 6749 §4.1.3
   * requires the two to be identical, and computing it twice is how they drift.
   */
  callbackUri: string;
  /** `null` when the driver declared `pkce: null`. */
  codeChallengeMethod: CodeChallengeMethod | null;
  codeVerifier: string | null;
  nonce: string;
  redirect: URL;
  responseType: ResponseType;
  scope: string;
  state: string;
};

export type LogoutQuery = Partial<
  Omit<LogoutRequest, "clientId" | "postLogoutRedirectUri" | "state">
>;

/**
 * Logout is not one shape across providers — an OP with RP-initiated logout
 * redirects, one that revokes server-side (or does nothing at all) leaves
 * nothing to redirect to. The driver says which happened; `state` is pylon's,
 * and only the redirect flavour ever comes back to a callback.
 */
export type LogoutResult = PylonAuthLogoutResult & { state: string };

/**
 * What the configured driver can actually serve. DERIVED from the driver
 * (`Boolean(driver.introspect)`), never configured, so it cannot disagree with
 * reality the way a settings flag could. It is read off
 * `ctx.state.app.config.auth.capabilities` — a NOUN, and nouns live in state.
 */
export type PylonAuthCapabilities = {
  readonly introspect: boolean;
  readonly userinfo: boolean;
};

/**
 * Per-call control of the RFC 7662 introspection cache — tier ONE of the TTL
 * resolution (`cache.ttl` ?? `auth.cache.introspection.ttl` ?? ten seconds), and
 * the sensitive-route carve-out: `cache: false` introspects on EVERY call even
 * where the deployment enables caching. Only ever narrows; a caller cannot turn
 * a cache on that the deployment did not configure.
 */
export type PylonIntrospectOptions = {
  cache?: PylonAuthCacheEntry;
};

/**
 * ⚠ VERBS ONLY. Everything a handler could want to KNOW about auth — the
 * issuer, the client id, what the driver can serve, what is cached — is state,
 * and lives on `ctx.state.app.config.auth`. This is what it can DO.
 *
 * Claims resolution only — available on both HTTP and socket contexts.
 */
export type PylonAuthClaimsClient = {
  introspect(
    token?: string,
    options?: PylonIntrospectOptions,
  ): Promise<PylonIntrospection>;
  userinfo(token?: string): Promise<PylonUserinfo>;
};

/**
 * The identity the provider knows this pylon by, and the only two inputs the
 * driver-response caches key on besides the token itself (RFC 7662 §2.2).
 *
 * ⚠ The MINIMUM, and never `clientSecret`. A per-request context member holding
 * a client secret is one debug log away from a leak — and pylon does log context
 * fields at debug.
 */
export type PylonAuthClientConfig = {
  readonly issuer: string;
  readonly clientId: string;
};

// Full auth client — available on HTTP contexts only.
// Extends claims client with IdP interaction methods that require
// HTTP-specific state (origin for redirects, router config).
export type PylonAuthClient = PylonAuthClaimsClient & {
  login(query?: AuthorizeQuery): Promise<AuthorizeResult>;
  logout(query?: LogoutQuery): Promise<LogoutResult>;
};
