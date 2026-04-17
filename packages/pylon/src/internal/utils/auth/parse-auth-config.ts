import { ReadableTime } from "@lindorm/date";
import { merge } from "@lindorm/utils";
import {
  PylonAuthConfig,
  PylonAuthOptions,
  PylonAuthRefreshConfig,
  PylonAuthRouterConfig,
} from "../../../types";

const REFRESH_DEFAULTS: PylonAuthRefreshConfig = {
  maxAge: "1h",
  mode: "half_life",
};

const DEFAULT_TOKEN_EXPIRY: ReadableTime = "1d";

const ROUTER_DEFAULTS: PylonAuthRouterConfig = {
  errorRedirect: "/error",
  pathPrefix: "/auth",

  authorize: {
    acrValues: null,
    codeChallengeMethod: "S256",
    maxAge: null,
    prompt: null,
    resource: null,
    responseType: "code",
    scope: ["openid", "offline_access", "email", "profile"],
  },

  dynamicRedirectDomains: [],

  resourceKey: "resource",

  cookies: {
    login: "pylon_login_session",
    logout: "pylon_logout_session",
  },

  staticRedirect: {
    login: null,
    logout: null,
  },
};

export const parseAuthConfig = (options: PylonAuthOptions): PylonAuthConfig => {
  const router = options.router
    ? merge<PylonAuthRouterConfig>(ROUTER_DEFAULTS, options.router)
    : null;

  if (router) {
    router.errorRedirect =
      options.router?.errorRedirect ?? router.pathPrefix + router.errorRedirect;
  }

  const refresh = merge<PylonAuthRefreshConfig>(REFRESH_DEFAULTS, options.refresh ?? {});

  return {
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    issuer: options.issuer,
    defaultTokenExpiry: options.defaultTokenExpiry ?? DEFAULT_TOKEN_EXPIRY,
    refresh,
    router,
  };
};
