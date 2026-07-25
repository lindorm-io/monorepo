import { Conduit, conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import type { ILogger } from "@lindorm/logger";
import type { AmphoraSettings } from "../../types/index.js";

/**
 * The single Conduit every external (and idp) fetch flows through. SSRF-hardened
 * by default: `maxRedirects` is `0` — a discovery / JWKS endpoint has no
 * legitimate reason to redirect, and following one lets a `jwks_uri` that already
 * passed a caller's egress guard 302 to an internal host AFTER the check. The
 * optional `lookup` pins the fetch to a validated IP (closes the connect-time
 * re-resolve / DNS-rebinding gap `maxRedirects: 0` does not).
 */
export const createExternalConduit = (
  settings: AmphoraSettings,
  logger: ILogger,
): Conduit =>
  new Conduit({
    alias: "Amphora",
    config: { maxRedirects: settings.maxRedirects ?? 0 },
    lookup: settings.lookup,
    logger,
    middleware: [conduitChangeResponseDataMiddleware()],
    retryOptions: { maxAttempts: 3 },
    timeout: 10000,
  });
