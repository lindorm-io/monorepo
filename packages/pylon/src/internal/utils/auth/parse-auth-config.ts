import type { ReadableTime } from "@lindorm/date";
import { merge } from "@lindorm/utils";
import type {
  PylonAuthConfig,
  PylonAuthSettings,
  PylonAuthRefreshConfig,
  PylonAuthRouterConfig,
} from "../../../types/index.js";

/**
 * ⚠ `mode` is NOT here — the DRIVER supplies it. A provider with no refresh
 * grant says so by omitting the method (GitHub classic tokens never expire), and
 * a fixed `half_life` default would make the resolved config contradict that
 * every time, leaving `mode` and `driver.refresh` as two statements of one fact.
 * So the default is `half_life` when the driver can refresh and `none` when it
 * cannot, and only a mode the DEPLOYMENT wrote can disagree with the driver.
 */
const REFRESH_DEFAULTS: Omit<PylonAuthRefreshConfig, "mode"> = {
  maxAge: "1h",
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

  const refresh = merge<PylonAuthRefreshConfig>(
    { ...REFRESH_DEFAULTS, mode: options.driver.refresh ? "half_life" : "none" },
    options.refresh ?? {},
  );

  return {
    driver: options.driver,
    defaultTokenExpiry: options.defaultTokenExpiry ?? DEFAULT_TOKEN_EXPIRY,
    refresh,
    router,
  };
};
