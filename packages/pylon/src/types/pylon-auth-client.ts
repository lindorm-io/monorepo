import type { AegisIntrospection, AegisUserinfo } from "@lindorm/aegis";
import type {
  OpenIdAuthorizeRequestQuery,
  OpenIdLogoutRequest,
  OpenIdResponseType,
  OpenIdTokenRequest,
  OpenIdTokenResponse,
  PkceMethod,
} from "@lindorm/types";

export type AuthorizeQuery = Partial<
  Omit<
    OpenIdAuthorizeRequestQuery,
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
  codeChallengeMethod: PkceMethod;
  codeVerifier: string;
  nonce: string;
  redirect: URL;
  responseType: OpenIdResponseType;
  scope: string;
  state: string;
};

export type LogoutQuery = Partial<
  Omit<OpenIdLogoutRequest, "clientId" | "postLogoutRedirectUri" | "state">
>;

export type LogoutResult = {
  redirect: URL;
  state: string;
};

export type TokenRequest = Omit<OpenIdTokenRequest, "clientId" | "clientSecret">;

// Claims resolution only — available on both HTTP and socket contexts.
export type PylonAuthClaimsClient = {
  introspect(token?: string): Promise<AegisIntrospection>;
  userinfo(token?: string): Promise<AegisUserinfo>;
};

// Full auth client — available on HTTP contexts only.
// Extends claims client with IdP interaction methods that require
// HTTP-specific state (origin for redirects, router config).
export type PylonAuthClient = PylonAuthClaimsClient & {
  login(query?: AuthorizeQuery): AuthorizeResult;
  logout(query?: LogoutQuery): LogoutResult;
  token(body: TokenRequest): Promise<OpenIdTokenResponse>;
};
