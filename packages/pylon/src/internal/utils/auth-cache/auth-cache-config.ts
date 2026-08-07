import type { ReadableTime } from "@lindorm/date";
import type { IProteusSource } from "@lindorm/proteus";

/**
 * One cached concern's policy. `false` is OFF — the same spelling
 * `createAccessTokenMiddleware({ cache: false })` already uses per mount, so
 * "off" has ONE idiom rather than two.
 */
export type AuthCacheEntryOptions = false | { ttl?: ReadableTime };

/**
 * The deployment's driver-response cache wiring, attached to the context by the
 * dependencies middleware. Present ONLY when `auth.cache.enabled` is set and a
 * key-value source resolved — its absence is what turns caching off, so there is
 * no second flag free to disagree with it.
 *
 * ⚠ The per-concern TTLs are passed through UNRESOLVED. Introspection resolves
 * over three tiers (per-mount, deployment, built-in) and userinfo over two, each
 * in one expression at its own call site.
 */
export type AuthCacheConfig = {
  kv: IProteusSource;
  introspection?: AuthCacheEntryOptions;
  userinfo?: AuthCacheEntryOptions;
};
