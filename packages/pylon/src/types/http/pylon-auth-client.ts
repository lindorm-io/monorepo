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

// Full auth client — available on HTTP contexts only.
// Extends claims client with IdP interaction methods that require
// HTTP-specific state (origin for redirects, router config).
export type PylonAuthClient = PylonAuthClaimsClient & {
  login(query?: AuthorizeQuery): AuthorizeResult;
  logout(query?: LogoutQuery): LogoutResult;
  token(body: TokenRequest): Promise<TokenResponse>;
};
