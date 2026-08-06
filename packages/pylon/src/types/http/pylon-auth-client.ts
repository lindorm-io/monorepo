import type {
  AuthorizeRequestQuery,
  CodeChallengeMethod,
  LogoutRequest,
  ResponseType,
  TokenResponse,
  TokenRequest as OpenIdTokenRequest,
} from "@lindorm/openid";
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
  codeChallengeMethod: CodeChallengeMethod;
  codeVerifier: string;
  nonce: string;
  redirect: URL;
  responseType: ResponseType;
  scope: string;
  state: string;
};

export type LogoutQuery = Partial<
  Omit<LogoutRequest, "clientId" | "postLogoutRedirectUri" | "state">
>;

export type LogoutResult = {
  redirect: URL;
  state: string;
};

export type TokenRequest = Omit<OpenIdTokenRequest, "clientId" | "clientSecret">;

// Claims resolution only — available on both HTTP and socket contexts.
export type PylonAuthClaimsClient = {
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
  /** `null` when no `auth` block is configured — every method throws there. */
  config: PylonAuthClientConfig | null;
  login(query?: AuthorizeQuery): AuthorizeResult;
  logout(query?: LogoutQuery): LogoutResult;
  token(body: TokenRequest): Promise<TokenResponse>;
};
