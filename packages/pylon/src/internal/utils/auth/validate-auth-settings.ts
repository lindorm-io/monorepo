import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { PylonAuthSettings } from "../../../types/index.js";

/**
 * Hold the deployment's configuration against what its driver can actually do,
 * at setup, rather than letting the first user request discover it as a 500.
 *
 * The test for error-versus-warning is whether there is a coherent thing to do
 * WITHOUT the capability:
 *
 * - A mounted `/login` that cannot authorize has no answer at all — nothing
 *   degrades, so it THROWS.
 * - A cache with no `introspect` is simply dead, and a refresh mode the driver
 *   cannot honour is simply off. Both are workable deployments, so they WARN —
 *   once, because config that states an intent pylon silently discards is the
 *   shape of the bugs this repo keeps finding.
 *
 * ⚠ Every warning here is about config the DEPLOYMENT WROTE. A default pylon
 * derived itself can never contradict the driver it was derived from, so it
 * never warns — a warning that fires on correct config is worse than none.
 */
export const validateAuthSettings = (
  settings: PylonAuthSettings,
  logger: ILogger,
): void => {
  const { driver } = settings;

  if (settings.router) {
    const missing: Array<string> = [
      ...(driver.authorize ? [] : ["authorize"]),
      ...(driver.exchange ? [] : ["exchange"]),
    ];

    if (missing.length) {
      throw new ServerError("Auth driver cannot serve the configured auth router", {
        code: "auth_driver_cannot_serve_router",
        title: "Auth Driver Cannot Serve Router",
        type: "urn:lindorm:pylon:error:auth_driver_cannot_serve_router",
        details:
          "`auth.router` mounts /login and /login/callback, which need the driver to build an authorization request AND to redeem the code it returns. A driver with one but not the other lets a user start a login that can never finish. Remove `auth.router` for a pure resource server, or configure a driver that implements both.",
        data: { missing },
      });
    }
  }

  // ⚠ Only a mode the DEPLOYMENT WROTE can be a misconfiguration. The absent
  // method is the declaration, and `parseAuthConfig` already reads the default
  // off it, so an unwritten mode agrees with the driver by construction — warning
  // on it would fire on correct config and teach people to ignore warnings.
  if (
    !driver.refresh &&
    isString(settings.refresh?.mode) &&
    settings.refresh.mode !== "none"
  ) {
    logger.warn(
      "Auth refresh is configured but the driver implements no refresh method; refresh is off",
      { mode: settings.refresh.mode },
    );
  }

  // ⚠ `cache.enabled` is CACHE policy — the ttls and `auth.encryption` are all
  // cache concerns. It never declared that this
  // deployment introspects or reads userinfo; those are `driver.introspect` and
  // `driver.userinfo`. Without one, that half of the cache is dead, not broken —
  // so each concern warns for itself, and only when it is actually switched on.
  if (settings.cache?.enabled && settings.cache.introspection !== false) {
    if (!driver.introspect) {
      logger.warn(
        "Auth introspection caching is enabled but the driver implements no introspect method; nothing will be cached",
      );
    }
  }

  if (settings.cache?.enabled && settings.cache.userinfo !== false) {
    if (!driver.userinfo) {
      logger.warn(
        "Auth userinfo caching is enabled but the driver implements no userinfo method; nothing will be cached",
      );
    }
  }
};
