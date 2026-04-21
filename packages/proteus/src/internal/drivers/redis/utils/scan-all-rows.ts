import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import type { Redis } from "ioredis";
import type { MetaField, MetaRelation } from "../../../entity/types/metadata.js";
import { RedisDriverError } from "../errors/RedisDriverError.js";
import { deserializeHash } from "./deserialize-hash.js";
import { scanEntityKeys } from "./scan-entity-keys.js";

/**
 * SCAN all keys matching a pattern, HGETALL each, and deserialize to rows.
 *
 * Used by RedisExecutor and RedisQueryBuilder to retrieve all entity rows
 * from Redis for client-side filtering.
 */
export const scanAllRows = async (
  client: Redis,
  pattern: string,
  fields: Array<MetaField>,
  relations: Array<MetaRelation>,
  logger?: ILogger | null,
): Promise<Array<Dict>> => {
  const keys = await scanEntityKeys(client, pattern);

  if (keys.length === 0) return [];

  const pipeline = client.pipeline();
  for (const key of keys) {
    pipeline.hgetall(key);
  }
  const results = await pipeline.exec();

  if (!results) {
    throw new RedisDriverError("Pipeline execution failed — returned null");
  }

  const rows: Array<Dict> = [];
  for (let i = 0; i < results.length; i++) {
    const [err, hash] = results[i];
    if (err) {
      if (logger) {
        logger.warn("Pipeline slot error in scanAllRows", {
          slotIndex: i,
          error: err.message,
        });
      }
      continue;
    }
    const row = deserializeHash(hash as Record<string, string>, fields, relations);
    if (row) rows.push(row);
  }

  return rows;
};
