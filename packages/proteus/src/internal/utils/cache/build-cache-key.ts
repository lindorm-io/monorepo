import { createHash } from "node:crypto";

export type BuildCacheKeyInput = {
  namespace: string | null;
  entityName: string;
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
  const { namespace, entityName, operation, criteria, options } = input;

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

  const ns = namespace ? `${namespace}:` : "";
  return `${ns}cache:${entityName}:${operation}:${hash}`;
};

export const buildCachePrefix = (
  namespace: string | null,
  entityName: string,
): string => {
  const ns = namespace ? `${namespace}:` : "";
  return `${ns}cache:${entityName}:`;
};
