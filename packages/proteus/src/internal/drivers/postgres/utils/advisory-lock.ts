import type { PostgresQueryClient } from "../types/postgres-query-client.js";

export const withAdvisoryLock = async <T>(
  client: PostgresQueryClient,
  key1: number,
  key2: number,
  fn: () => Promise<T>,
): Promise<T | null> => {
  const result = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock($1, $2) AS locked`,
    [key1, key2],
  );

  if (result.rows[0]?.locked !== true) {
    return null;
  }

  try {
    return await fn();
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock($1, $2)`, [key1, key2]);
    } catch {
      // Unlock failure is secondary — PG auto-releases session-level locks on disconnect.
      // Swallowing here preserves the original error (if fn() threw) or the return value.
    }
  }
};
