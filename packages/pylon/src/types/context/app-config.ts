import type { PylonAuthCapabilities } from "../http/pylon-auth-client.js";
import type { PylonAuthCacheConfig } from "../settings/auth-settings.js";
import type { PylonRateLimitStrategy } from "../settings/feature-settings.js";

/**
 * The deployment's audit policy. It holds NO storage handle — the record is
 * published through `ctx.bus`, the request-scoped session every other feature
 * reads its storage from.
 *
 * A mount may narrow it: `useAuditLog({ skip, sanitise })` wins over the
 * deployment's own, per option.
 */
export type AppAuditConfig = {
  readonly sanitise?: (body: unknown) => unknown;
  readonly skip?: (ctx: any) => boolean;
};

/**
 * The deployment's rate-limit policy, resolved. `window` is MILLISECONDS —
 * `useRateLimit` compares it against a mount's own window, and two spellings of
 * a duration cannot be compared.
 *
 * `window` / `max` are nullable because a bare `rateLimit: {}` is a legitimate
 * deployment: it turns the feature on for mounts that state their own limits
 * without imposing a global one.
 */
export type AppRateLimitConfig = {
  readonly strategy: PylonRateLimitStrategy;
  readonly window: number | null;
  readonly max: number | null;
  readonly key?: (ctx: any) => string;
  readonly skip?: (ctx: any) => boolean;
};

/**
 * Everything a request handler may know about this deployment's auth, resolved
 * ONCE after `amphora.setup()`.
 *
 * ⚠ Reading it NEVER throws. `null` on {@link AppConfig} is "no auth block
 * configured"; a driver that cannot answer one of these leaves it `null` here
 * rather than raising on a property read, because this is eager state on every
 * request of every pylon — including the ones with no auth at all.
 *
 * ⚠ Never `clientSecret`. A per-request context member holding a client secret
 * is one debug log away from a leak, and pylon does log context fields at debug.
 */
export type AppAuthConfig = {
  /**
   * The issuer the configured driver pins, from `endpoints()` — amphora's
   * resolved issuer for the scope the driver named, which for a tenant-scoped
   * provider is only settled at runtime.
   *
   * `null` when the driver could not resolve one at setup (no idp registered on
   * amphora, or one whose issuer amphora never settled). The driver still throws
   * by name on the request paths that genuinely need it; here it means only
   * "there is no issuer to key a cache on".
   */
  readonly issuer: string | null;
  /**
   * The client identifier the provider knows this pylon by. `null` for a
   * VERIFY-ONLY driver, which is nobody's OAuth client — an empty string would
   * be a client id that is simply wrong, and would key every such pylon's cache
   * entries together.
   */
  readonly clientId: string | null;
  /**
   * What the configured driver can actually serve. DERIVED from the driver
   * (`Boolean(driver.introspect)`), never configured, so it cannot disagree with
   * reality the way a settings flag could.
   */
  readonly capabilities: PylonAuthCapabilities;
  /**
   * The driver-response cache policy (RFC 7662 introspection, OIDC Core §5.3
   * userinfo). `false` is the whole off switch. It holds no storage handle: the
   * entries live in `ctx.cache` like every other evictable row.
   */
  readonly cache: PylonAuthCacheConfig | false;
};

/**
 * The ONE home for this deployment's resolved configuration and policy.
 *
 * ⚠ Built ONCE per process, after `amphora.setup()`, and handed to every
 * request of BOTH transports as the same frozen reference — none of it varies
 * per request. It is deeply frozen as well as `readonly`: a handler flipping a
 * policy mid-request would change behaviour for everything downstream in that
 * chain, and a `readonly` the compiler cannot see through (a cast, a plain
 * `any` ctx in a test) is not a guarantee.
 *
 * ⚠ `false` / `null` is OFF for every entry, and an object is ON. There is no
 * second `enabled` flag inside a policy free to disagree with the presence of
 * the policy itself.
 *
 * ⚠ There is NO `responseCache` entry, and its absence is the design rather
 * than an omission: every knob `useCache` reads — ttl, scope, vary, skip, actor
 * — is stated per MOUNT, so a deployment entry could only ever have been a
 * second switch beside the mount, free to disagree with it. Mounting `useCache`
 * IS the declaration that a route caches; the only thing it still needs from
 * the deployment is an evictable source, and it names that one by name.
 */
export type AppConfig = {
  readonly audit: AppAuditConfig | false;
  readonly rateLimit: AppRateLimitConfig | false;
  /** `null` is "this deployment configured no `auth` block". */
  readonly auth: AppAuthConfig | null;
};
