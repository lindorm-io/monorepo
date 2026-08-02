import { createHash } from "node:crypto";

export type BuildCachePrefixInput = {
  sourceNamespace: string | null;
  entityNamespace: string | null;
  entityName: string;
};

export type BuildCacheKeyInput = BuildCachePrefixInput & {
  operation: string;
  criteria?: unknown;
  options?: Record<string, unknown>;
};

export const sortDeep = (value: unknown): unknown => {
  if (value instanceof Date) return value;
  if (value instanceof Map) return sortDeep(Object.fromEntries(value));
  if (value instanceof Set) return [...value].map(sortDeep);
  if (value instanceof RegExp) return value.toString();
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
};

export const replacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return String(value);
  return value;
};

export const buildCacheKey = (input: BuildCacheKeyInput): string => {
  const { operation, criteria, options } = input;

  const cleanOptions: Record<string, unknown> = options ? { ...options } : {};
  delete cleanOptions.cache;
  delete cleanOptions.lock;

  if (Array.isArray(cleanOptions.relations)) {
    cleanOptions.relations = [...(cleanOptions.relations as Array<string>)].sort();
  }
  if (Array.isArray(cleanOptions.select)) {
    cleanOptions.select = [...(cleanOptions.select as Array<string>)].sort();
  }

  const payload = { criteria: sortDeep(criteria), options: sortDeep(cleanOptions) };
  const json = JSON.stringify(payload, replacer);
  // 16 hex chars = 64 bits. Birthday collision at ~4B entries — acceptable for
  // a TTL-bounded cache where collisions are self-correcting via invalidation/expiry.
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 16);

  // Built FROM the prefix, never alongside it: a key that does not start with the
  // prefix invalidation deletes would leave writes silently serving stale reads.
  return `${buildCachePrefix(input)}${operation}:${hash}`;
};

/**
 * The prefix EVERY cache key of a source lives under. Flushing this evicts the
 * whole query cache for the namespace in one adapter round-trip.
 */
export const buildCacheRootPrefix = (namespace: string | null): string =>
  namespace ? `${namespace}:cache:` : "cache:";

/**
 * The prefix every cache key of ONE entity lives under — the exact string
 * `buildCacheKey` builds from, so invalidation can never drift from its keys.
 *
 * An entity's own `@Namespace` puts it in a different schema/database than the
 * source's, so two same-named entities in two namespaces are two distinct tables
 * and must not share a prefix. It is scoped INSIDE the source root (not in front
 * of it) so `buildCacheRootPrefix` still matches every key of the source, and
 * joined with "/" rather than ":" so a namespaced entity can never fall under an
 * un-namespaced one's prefix — "cache:billing/invoice:" does not start with
 * "cache:billing:". An entity namespace equal to the source's resolves to the very
 * same table as no namespace at all (see `getEntityName`), so it keys the same way
 * too — otherwise a write through one class would not invalidate the other.
 */
export const buildCachePrefix = (input: BuildCachePrefixInput): string => {
  const { sourceNamespace, entityNamespace, entityName } = input;

  const scoped =
    entityNamespace && entityNamespace !== sourceNamespace
      ? `${entityNamespace}/${entityName}`
      : entityName;

  return `${buildCacheRootPrefix(sourceNamespace)}${scoped}:`;
};
