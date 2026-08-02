import type { ReadableTime } from "@lindorm/date";
import type {
  CodeChallengeMethod,
  PromptMode,
  ResponseType,
  Scope,
} from "@lindorm/openid";
import type { DeepPartial } from "@lindorm/types";

export type PylonLoginCookie = {
  codeChallengeMethod: CodeChallengeMethod;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  responseType: ResponseType;
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
  codeChallengeMethod: CodeChallengeMethod;
  maxAge: ReadableTime | null;
  prompt: PromptMode | null;
  resource: string | null;
  responseType: ResponseType;
  /**
   * The scopes pylon asks the external IdP for. RFC 6749 §3.3 lets every
   * deployment define its own values (`read:users`, an API identifier, …), so
   * the operator may configure anything — `@lindorm/openid`'s `Scope` is the
   * autocomplete hint here, not the constraint.
   */
  scope: Array<Scope | (string & {})>;
};

export type PylonAuthResourceKey = "resource" | "audience";

export type PylonAuthRouterConfig = {
  errorRedirect: string;
  pathPrefix: string;

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

export type PylonAuthSettings = {
  clientId: string;
  clientSecret: string;
  issuer: string;
  defaultTokenExpiry?: ReadableTime;
  refresh?: Partial<PylonAuthRefreshConfig>;
  router?: DeepPartial<PylonAuthRouterConfig>;
};
