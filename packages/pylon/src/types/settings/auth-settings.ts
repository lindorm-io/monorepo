import type { ReadableTime } from "@lindorm/date";
import type { CodeChallengeMethod, ResponseType } from "@lindorm/openid";
import type { IProteusSource } from "@lindorm/proteus";
import type { DeepPartial } from "@lindorm/types";
import type { IPylonAuthDriver } from "../../interfaces/PylonAuthDriver.js";
import type { PylonEncKey } from "./keys.js";

export type PylonLoginCookie = {
  /**
   * The callback URI handed to the driver's `authorize`, replayed VERBATIM to
   * `exchange` — RFC 6749 §4.1.3 requires the two to match exactly, so it is
   * computed once and carried here rather than rebuilt on the callback.
   */
  callbackUri: string;
  /** `null` when the flow ran without PKCE (a driver that declared `pkce: null`). */
  codeChallengeMethod: CodeChallengeMethod | null;
  codeVerifier: string | null;
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

/**
 * Everything the auto-mounted auth routes need, and NOTHING about the provider —
 * the authorization request's defaults (scope, response type, resource
 * indicator, PKCE transformation) belong to the driver, which is what talks to
 * the provider. A pure resource server omits `router` entirely.
 */
export type PylonAuthRouterConfig = {
  errorRedirect: string;
  pathPrefix: string;

  dynamicRedirectDomains: Array<string>;

  cookies: {
    login: string;
    logout: string;
  };

  staticRedirect: {
    login: string | null;
    logout: string | null;
  };
};

/**
 * The ONE home for driver-response caching. Today that is RFC 7662
 * introspection; anything cached later shares this block rather than growing a
 * second one beside it.
 *
 * Absent means OFF: RFC 7662 §5 expects a deployment sensitive enough to refuse
 * any caching to be able to say so, and saying nothing is saying no.
 *
 * ⚠ `ttl` IS the revocation window (RFC 7662 §5) and is measured in SECONDS, for
 * `active: false` answers as much as for live ones. Default `10 seconds`; a
 * single mount may shorten it, or opt out entirely, via
 * `createAccessTokenMiddleware({ cache })`.
 *
 * ⚠ `enabled` is CACHE policy, never a capability declaration. Whether this
 * deployment introspects at all is `driver.introspect` — a driver without it
 * simply leaves the cache dead, which pylon warns about once at boot.
 */
export type PylonAuthCacheSettings = {
  enabled: boolean;
  kv?: IProteusSource;
  ttl?: ReadableTime;
  /**
   * The at-rest KEK selector staged onto `CachedIntrospection.payload` before the
   * source sets up. The cached answer is the claim set of a LIVE credential —
   * subject, scope, delegation — sitting in shared storage, so proteus seals it
   * on write and opens it transparently on read. Default
   * `{ condition: { purpose: "pylon:kek" } }` — the same bootstrap KEK as kryptos
   * and webhook; override it (e.g. its own `purpose`) for a separate blast
   * radius. Same `{ kryptos?, condition? }` descriptor as every other key
   * surface; `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
};

export type PylonAuthConfig = {
  driver: IPylonAuthDriver;
  defaultTokenExpiry: ReadableTime;
  refresh: PylonAuthRefreshConfig;
  router: PylonAuthRouterConfig | null;
};

/**
 * ⚠ `driver` is REQUIRED. Client credentials, the issuer and the authorization
 * request's defaults are the PROVIDER's, so they live on the driver — pylon
 * holds only the parts it owns itself: the routes, the cache, the refresh
 * policy and the fallback token lifetime.
 */
export type PylonAuthSettings = {
  driver: IPylonAuthDriver;
  router?: DeepPartial<PylonAuthRouterConfig>;
  cache?: PylonAuthCacheSettings;
  refresh?: Partial<PylonAuthRefreshConfig>;
  defaultTokenExpiry?: ReadableTime;
};
