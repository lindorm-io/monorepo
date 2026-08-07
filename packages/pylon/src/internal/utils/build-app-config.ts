import type { IAmphora } from "@lindorm/amphora";
import { ms } from "@lindorm/date";
import { isEmpty, isNumber, isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { Environment } from "@lindorm/types";
import type {
  AppAuditConfig,
  AppAuthConfig,
  AppConfig,
  AppRateLimitConfig,
  AppResponseCacheConfig,
  PylonAuditSettings,
  PylonAuthSettings,
  PylonRateLimitSettings,
  PylonResponseCacheSettings,
} from "../../types/index.js";
import { createSetupDriverContext } from "./auth/create-setup-driver-context.js";

type Options = {
  amphora: IAmphora;
  audit?: PylonAuditSettings;
  auth?: PylonAuthSettings;
  environment?: Environment;
  logger: ILogger;
  rateLimit?: PylonRateLimitSettings;
  responseCache?: PylonResponseCacheSettings;
};

const buildAudit = (settings: PylonAuditSettings | undefined): AppAuditConfig | false => {
  if (!settings?.enabled) return false;

  return Object.freeze({
    ...(settings.sanitise && { sanitise: settings.sanitise }),
    ...(settings.skip && { skip: settings.skip }),
  });
};

const buildResponseCache = (
  settings: PylonResponseCacheSettings | undefined,
): AppResponseCacheConfig | false => (settings?.enabled ? Object.freeze({}) : false);

const buildRateLimit = (
  settings: PylonRateLimitSettings | undefined,
): AppRateLimitConfig | false => {
  if (!settings?.enabled) return false;

  return Object.freeze({
    strategy: settings.strategy ?? "fixed",
    // Resolved to milliseconds HERE so `useRateLimit` never has to decide
    // whether a mount's window and the deployment's are the same spelling of
    // the same duration.
    window: isNumber(settings.window)
      ? settings.window
      : isString(settings.window)
        ? ms(settings.window)
        : null,
    max: isNumber(settings.max) ? settings.max : null,
    ...(settings.key && { key: settings.key }),
    ...(settings.skip && { skip: settings.skip }),
  });
};

const buildAuth = (
  settings: PylonAuthSettings,
  options: Options,
): AppAuthConfig | null => {
  const { driver } = settings;

  // The driver's own issuer, asked for once. It THROWS by name when the scope it
  // pinned resolves to nothing (`idp_not_configured`, `idp_issuer_unresolved`,
  // `self_issuer_not_configured`), and that must not take the process down here:
  // this block is read on every request of every pylon, and the request paths
  // that genuinely need an issuer still raise the driver's own error where the
  // operator can act on it. `null` means only "there is no issuer to key a
  // driver-response cache on".
  let issuer: string | null = null;

  try {
    issuer = driver.endpoints(
      createSetupDriverContext({
        amphora: options.amphora,
        environment: options.environment ?? "unknown",
        logger: options.logger,
      }),
    ).issuer;
  } catch (error: any) {
    options.logger.warn(
      "Auth driver could not resolve its issuer at setup; driver-response caching is off and issuer-dependent routes will fail",
      { error },
    );
  }

  return Object.freeze({
    issuer,
    // ⚠ `isEmpty` as well as `isString`: `""` is a client id that is simply
    // WRONG, not an absent one, and it would key every pylon that carries it
    // into one shared cache entry.
    clientId:
      isString(driver.clientId) && !isEmpty(driver.clientId) ? driver.clientId : null,
    capabilities: Object.freeze({
      introspect: Boolean(driver.introspect),
      userinfo: Boolean(driver.userinfo),
    }),
    // The ONE place driver-response caching is switched on. `enabled: false` and
    // an absent block collapse to the same `false`.
    cache: settings.cache?.enabled
      ? Object.freeze({
          ...(settings.cache.introspection !== undefined && {
            introspection: settings.cache.introspection,
          }),
          ...(settings.cache.userinfo !== undefined && {
            userinfo: settings.cache.userinfo,
          }),
        })
      : false,
  });
};

/**
 * Resolve the deployment's whole policy surface, ONCE, after `amphora.setup()`.
 *
 * ⚠ Every input is process-stable — feature switches, TTLs, driver identity —
 * so the result is built once and handed to every request of both transports as
 * the same frozen reference. Nothing here may be re-derived per request, and
 * nothing per-request may be put in it: tokens, sessions and authorization are
 * `ctx.state`, not `ctx.state.app.config`.
 *
 * Frozen at every level, not merely typed `readonly`: a handler flipping a
 * policy mid-request changes behaviour for everything downstream in that chain,
 * and `readonly` stops at the first cast.
 */
export const buildAppConfig = (options: Options): AppConfig =>
  Object.freeze({
    audit: buildAudit(options.audit),
    responseCache: buildResponseCache(options.responseCache),
    rateLimit: buildRateLimit(options.rateLimit),
    auth: options.auth ? buildAuth(options.auth, options) : null,
  });
