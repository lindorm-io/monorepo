import { ReadableTime } from "@lindorm/date";
import { PkceMethod } from "@lindorm/types";
import {
  DeepPartial,
  OpenIdPromptMode,
  OpenIdResponseType,
  OpenIdScope,
} from "@lindorm/types";

export type PylonLoginCookie = {
  codeChallengeMethod: PkceMethod;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  responseType: OpenIdResponseType;
  scope: string;
  state: string;
};

export type PylonLogoutCookie = {
  redirectUri: string;
  state: string;
};

export const PYLON_REFRESH_MODE = ["force", "half_life", "max_age", "none"] as const;

export type PylonRefreshMode = (typeof PYLON_REFRESH_MODE)[number];

export type PylonAuthRefreshConfig = {
  maxAge: ReadableTime;
  mode: PylonRefreshMode;
};

export type PylonAuthAuthorizeConfig = {
  acrValues: string | null;
  codeChallengeMethod: PkceMethod;
  maxAge: ReadableTime | null;
  prompt: OpenIdPromptMode | null;
  resource: string | null;
  responseType: OpenIdResponseType;
  scope: Array<OpenIdScope>;
};

export type PylonAuthResourceKey = "resource" | "audience";

export type PylonAuthRouterConfig = {
  errorRedirect: string;
  pathPrefix: string;

  /**
   * Gates the `GET /:prefix/introspect` endpoint, which exposes the
   * result of `ctx.auth.introspect()` (RFC 7662 token metadata).
   * Opt-in because token introspection leaks scope, expiry, and
   * client_id — not something every app wants on the wire.
   */
  introspect: boolean;

  authorize: PylonAuthAuthorizeConfig;

  dynamicRedirectDomains: Array<string>;

  /**
   * Wire-format name for the Resource Indicator on the authorize
   * request. Defaults to `"resource"` (RFC 8707). Set to `"audience"`
   * for Auth0 tenants without the Resource Parameter Compatibility
   * Profile enabled, or any OP that only recognises the proprietary
   * `audience` parameter.
   */
  resourceKey: PylonAuthResourceKey;

  expose: {
    accessToken: boolean;
    idToken: boolean;
    scope: boolean;
    subject: boolean;
  };

  cookies: {
    login: string;
    logout: string;
  };

  staticRedirect: {
    login: string | null;
    logout: string | null;
  };
};

export type PylonAuthConfig = {
  clientId: string;
  clientSecret: string;
  issuer: string;
  defaultTokenExpiry: ReadableTime;
  refresh: PylonAuthRefreshConfig;
  router: PylonAuthRouterConfig | null;
};

export type PylonAuthOptions = {
  clientId: string;
  clientSecret: string;
  issuer: string;
  defaultTokenExpiry?: ReadableTime;
  refresh?: Partial<PylonAuthRefreshConfig>;
  router?: DeepPartial<PylonAuthRouterConfig>;
};
