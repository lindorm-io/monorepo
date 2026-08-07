import type { ReadableTime } from "@lindorm/date";
import { merge } from "@lindorm/utils";
import type {
  PylonAuthCacheConfig,
  PylonAuthConfig,
  PylonAuthSettings,
  PylonAuthRefreshConfig,
  PylonAuthRouterConfig,
} from "../../../types/index.js";

const REFRESH_DEFAULTS: PylonAuthRefreshConfig = {
  maxAge: "1h",
  mode: "half_life",
};

const DEFAULT_TOKEN_EXPIRY: ReadableTime = "1d";

const ROUTER_DEFAULTS: PylonAuthRouterConfig = {
  errorRedirect: "/error",
  pathPrefix: "/auth",

  dynamicRedirectDomains: [],

  cookies: {
    login: "pylon_login_session",
    logout: "pylon_logout_session",
  },

  staticRedirect: {
    login: null,
    logout: null,
  },
};

export const parseAuthConfig = (options: PylonAuthSettings): PylonAuthConfig => {
  const router = options.router
    ? merge<PylonAuthRouterConfig>(ROUTER_DEFAULTS, options.router)
    : null;

  if (router) {
    router.errorRedirect =
      options.router?.errorRedirect ?? router.pathPrefix + router.errorRedirect;
  }

  const refresh = merge<PylonAuthRefreshConfig>(REFRESH_DEFAULTS, options.refresh ?? {});

  // The ONE place the driver-response cache is switched on. `enabled: false` and
  // an absent block collapse to the same `null`, which is the only off switch
  // the two cache utilities ever consult.
  const cache: PylonAuthCacheConfig | null = options.cache?.enabled
    ? { introspection: options.cache.introspection, userinfo: options.cache.userinfo }
    : null;

  return {
    cache,
    driver: options.driver,
    defaultTokenExpiry: options.defaultTokenExpiry ?? DEFAULT_TOKEN_EXPIRY,
    refresh,
    router,
  };
};
