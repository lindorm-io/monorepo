import { ServerError } from "@lindorm/errors";
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
 * - Refresh with no `refresh` method is simply off, and the cache with no
 *   `introspect` is simply dead. Both are workable deployments, so they WARN —
 *   once, because config that states an intent pylon silently discards is the
 *   shape of the bugs this repo keeps finding.
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

  // ⚠ The ABSENT METHOD is the declaration, so there is no `mode: "none"` to
  // require alongside it — two statements of one fact are free to drift.
  if (!driver.refresh && (settings.refresh?.mode ?? "half_life") !== "none") {
    logger.warn(
      "Auth refresh is configured but the driver implements no refresh method; refresh is off",
      { mode: settings.refresh?.mode ?? "half_life" },
    );
  }

  // ⚠ `cache.enabled` is CACHE policy — the ttls, `auth.kv` and
  // `auth.encryption` are all cache concerns. It never declared that this
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
