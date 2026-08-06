import type {
  AuthorizeRequestQuery,
  CodeChallengeMethod,
  LogoutRequest,
  ResponseType,
} from "@lindorm/openid";
import type { PylonAuthLogoutResult } from "../auth/pylon-auth-driver-options.js";
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
 * reality the way a settings flag could.
 */
export type PylonAuthCapabilities = {
  readonly introspect: boolean;
  readonly userinfo: boolean;
};

// Claims resolution only — available on both HTTP and socket contexts.
export type PylonAuthClaimsClient = {
  readonly capabilities: PylonAuthCapabilities;
  introspect(token?: string): Promise<PylonIntrospection>;
  userinfo(token?: string): Promise<PylonUserinfo>;
};

/**
 * The client's own identity, as much of it as a request handler may see.
 *
 * ⚠ The MINIMUM, and never `clientSecret`. A per-request context member holding
 * a client secret is one debug log away from a leak — and pylon does log context
 * fields at debug. Both members are what an introspection answer varies by (RFC
 * 7662 §2.2), which is what this exists for; read-only, nothing more.
 */
export type PylonAuthClientConfig = {
  readonly issuer: string;
  readonly clientId: string;
};

// Full auth client — available on HTTP contexts only.
// Extends claims client with IdP interaction methods that require
// HTTP-specific state (origin for redirects, router config).
export type PylonAuthClient = PylonAuthClaimsClient & {
  /**
   * ⚠ A METHOD, not a property: the issuer comes from `driver.endpoints()`, and
   * a provider whose issuer is only known at runtime (a tenant-scoped Microsoft
   * deployment) cannot be read from static settings. Throws when no `auth` block
   * is configured.
   */
  config(): Promise<PylonAuthClientConfig>;
  login(query?: AuthorizeQuery): Promise<AuthorizeResult>;
  logout(query?: LogoutQuery): Promise<LogoutResult>;
};
