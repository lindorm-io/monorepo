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

export type PylonAuthConfig = {
  clientId: string;
  clientSecret: string;
  issuer: string;

  codeChallengeMethod: PkceMethod;
  errorRedirect: string;
  pathPrefix: string;
  tokenExpiry: ReadableTime;

  defaults: {
    acrValues: string | null;
    audience: string | null;
    maxAge: ReadableTime | null;
    prompt: OpenIdPromptMode | null;
    responseType: OpenIdResponseType;
    scope: Array<OpenIdScope>;
  };

  dynamicRedirectDomains: Array<string>;

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

  refresh: {
    maxAge: ReadableTime;
    mode: PylonRefreshMode;
  };

  staticRedirect: {
    login: string | null;
    logout: string | null;
  };
};

export type PylonAuthOptions = Pick<
  PylonAuthConfig,
  "clientId" | "clientSecret" | "issuer"
> &
  DeepPartial<Omit<PylonAuthConfig, "clientId" | "clientSecret" | "issuer">>;
