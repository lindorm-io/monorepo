import type { Redis } from "ioredis";

/**
 * SCAN loop helper that collects all keys matching a given pattern.
 *
 * Uses SCAN with MATCH and COUNT 1000 to avoid blocking Redis.
 * Deduplicates results with a Set since SCAN may return duplicates
 * across iterations.
 *
 * The COUNT hint (1000) advises Redis on the approximate number of
 * entries to inspect per iteration. It does NOT limit the total
 * results — it only controls how much work Redis does per SCAN call.
 * A higher count reduces round-trips but increases per-call latency.
 * The value 1000 is a reasonable default for most workloads. Redis
 * may return more or fewer keys per iteration regardless of COUNT.
 *
 * Note: ioredis SCAN returns cursor as string, so the loop checks
 * for `cursor !== "0"`.
 */
export const scanEntityKeys = async (
  client: Redis,
  pattern: string,
): Promise<Array<string>> => {
  const found = new Set<string>();
  let cursor = "0";

  do {
    const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 1000);
    cursor = nextCursor;

    for (const key of keys) {
      found.add(key);
    }
  } while (cursor !== "0");

  return Array.from(found);
};
