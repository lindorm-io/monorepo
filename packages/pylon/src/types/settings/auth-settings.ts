import type { ReadableTime } from "@lindorm/date";
import type { CodeChallengeMethod, ResponseType } from "@lindorm/openid";
import type { DeepPartial } from "@lindorm/types";
import type { IPylonAuthDriver } from "../../interfaces/PylonAuthDriver.js";
import type { PylonEncKey } from "./keys.js";
import type { PylonSessionSettings } from "./session-settings.js";

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
 * The ONE home for driver-response caching: RFC 7662 introspection and OIDC
 * Core §5.3 userinfo, each with its OWN ttl.
 *
 * Absent means OFF: RFC 7662 §5 expects a deployment sensitive enough to refuse
 * any caching to be able to say so, and saying nothing is saying no.
 *
 * ⚠ There is deliberately NO shared `ttl`. The two lifetimes answer different
 * questions — introspection's IS the revocation window and is measured in
 * seconds, userinfo's is a staleness tolerance on profile claims and is measured
 * in minutes — and one knob feeding both could only be read as "does it override
 * or seed the specific one?", an ambiguity with no good answer.
 *
 * ⚠ `enabled` is CACHE policy, never a capability declaration. Whether this
 * deployment introspects or reads userinfo at all is `driver.introspect` /
 * `driver.userinfo` — a driver without one simply leaves that half of the cache
 * dead, which pylon warns about once at boot.
 *
 * Storage is pylon's `cache` source (falling back to `kv`) — these entries are
 * evictable by construction. The KEK sealing them is `auth.encryption`.
 */
export type PylonAuthCacheSettings = {
  enabled: boolean;
  /**
   * The revocation window — SECONDS, RFC 7662 §5, for `active: false` answers as
   * much as for live ones. Default `10 seconds`; a single mount may shorten it,
   * or opt out entirely, via `createAccessTokenMiddleware({ cache })`. `false`
   * turns introspection caching off for the deployment while userinfo caching
   * stays on.
   */
  introspection?: PylonAuthCacheEntry;
  /**
   * Staleness tolerance for profile claims. Default `5 minutes` — there is no
   * revocation window to respect here, since a profile is not an authorization
   * decision. `false` turns userinfo caching off while introspection stays on.
   */
  userinfo?: PylonAuthCacheEntry;
};

/**
 * One cached concern's policy. `false` is OFF — the same spelling
 * `createAccessTokenMiddleware({ cache: false })` already uses per mount, so
 * "off" has ONE idiom rather than two.
 */
export type PylonAuthCacheEntry = false | { ttl?: ReadableTime };

/**
 * The resolved driver-response cache policy. It holds NO storage handle: the
 * entries live in `ctx.cache` like every other evictable row. `null` is the
 * whole off switch — `parseAuthConfig` produces it whenever the deployment did
 * not enable `auth.cache`, so there is no second flag free to disagree.
 *
 * ⚠ The per-concern TTLs are carried UNRESOLVED. Introspection resolves over
 * three tiers (per-mount, deployment, built-in) and userinfo over two, each in
 * one expression at its own call site.
 */
export type PylonAuthCacheConfig = {
  introspection?: PylonAuthCacheEntry;
  userinfo?: PylonAuthCacheEntry;
};

export type PylonAuthConfig = {
  cache: PylonAuthCacheConfig | null;
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
  /**
   * The session cookie. It lives HERE, not at the top level, because a pylon
   * session is not a state bag — `Session` is eight fields (id, accessToken,
   * expiresAt, idToken, issuedAt, refreshToken, scope, subject) with no `data`
   * and no consumer payload. A pylon session IS an OAuth artifact store; the
   * cookie is only how it is addressed. Nesting it under `auth` puts the store
   * next to the flow that fills it.
   */
  session?: PylonSessionSettings;
  /**
   * The at-rest KEK selector staged onto `CachedIntrospection.payload` and
   * `CachedUserinfo.payload` before the source sets up. Both hold data about a
   * LIVE credential — a claim set with subject, scope and delegation; a profile
   * with name, email and picture — sitting in shared storage, so proteus seals
   * them on write and opens them transparently on read. Default
   * `{ condition: { purpose: "pylon:kek" } }` — the same bootstrap KEK as kryptos
   * and webhook; override it (e.g. its own `purpose`) for a separate blast
   * radius. Same `{ kryptos?, condition? }` descriptor as every other key
   * surface; `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
  cache?: PylonAuthCacheSettings;
  refresh?: Partial<PylonAuthRefreshConfig>;
  defaultTokenExpiry?: ReadableTime;
};
