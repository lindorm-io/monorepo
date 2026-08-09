import type { ILogger } from "@lindorm/logger";
import type { Redis } from "ioredis";
import type { RelationStrategy } from "../../../../entity/types/metadata.js";
import { RedisDriverError } from "../../errors/RedisDriverError.js";

/** The hashes and join SETs one phase of relation loading needs. */
export type RedisReadBatch = {
  hashes: Array<string>;
  sets: Array<string>;
};

export type RedisReadResult = {
  hashes: Map<string, Record<string, string>>;
  sets: Map<string, Array<string>>;
};

export type RedisReader = (batch: RedisReadBatch) => Promise<RedisReadResult>;

/**
 * The reader a relation `strategy` selects.
 *
 * This is the ONLY thing the option changes on Redis, and it is the whole of
 * what the option means. `strategy` names a round-trip shape: "join" asks for
 * the fewest trips, "query" for more but smaller ones. A Redis pipeline is many
 * commands over one round trip, so "join" is a pipeline and "query" is the same
 * commands issued one at a time. Both read the identical set of keys — the plan
 * decides that — so the two strategies cannot land on different entities, only
 * on different numbers of trips.
 *
 * Redis cannot reach ONE round trip even under "join": the roots have to be
 * read before their related keys are known, and a many-to-many needs its link
 * SETs read before it knows which targets to fetch.
 */
export const createRedisReader = (
  strategy: RelationStrategy,
  client: Redis,
  logger?: ILogger,
): RedisReader =>
  strategy === "join"
    ? createPipelineReader(client, logger)
    : createCommandReader(client);

/** Every command in one pipeline: as few round trips as the data allows. */
const createPipelineReader =
  (client: Redis, logger?: ILogger): RedisReader =>
  async (batch) => {
    const hashes = unique(batch.hashes);
    const sets = unique(batch.sets);
    const result = emptyResult();

    if (hashes.length === 0 && sets.length === 0) return result;

    const pipeline = client.pipeline();
    for (const key of hashes) pipeline.hgetall(key);
    for (const key of sets) pipeline.smembers(key);

    const replies = await pipeline.exec();
    if (!replies) {
      throw new RedisDriverError("Pipeline execution failed — returned null", {
        code: "command_execution_failed",
        title: "Command Execution Failed",
        details:
          "The pipeline reading related hashes and join sets for a query-builder include returned null instead of results, so no relation could be resolved.",
      });
    }

    for (let index = 0; index < hashes.length; index++) {
      const [error, value] = replies[index];
      if (error) {
        warn(error, hashes[index], logger);
        continue;
      }
      result.hashes.set(hashes[index], value as Record<string, string>);
    }

    for (let index = 0; index < sets.length; index++) {
      const [error, value] = replies[hashes.length + index];
      if (error) {
        warn(error, sets[index], logger);
        continue;
      }
      result.sets.set(sets[index], value as Array<string>);
    }

    return result;
  };

/** One command per round trip: more trips, each smaller. */
const createCommandReader =
  (client: Redis): RedisReader =>
  async (batch) => {
    const result = emptyResult();

    for (const key of unique(batch.hashes)) {
      result.hashes.set(key, await client.hgetall(key));
    }

    for (const key of unique(batch.sets)) {
      result.sets.set(key, await client.smembers(key));
    }

    return result;
  };

const emptyResult = (): RedisReadResult => ({ hashes: new Map(), sets: new Map() });

const unique = (keys: Array<string>): Array<string> => [...new Set(keys)];

const warn = (error: Error, key: string, logger?: ILogger): void => {
  logger?.warn("Pipeline slot error while reading an included relation", {
    key,
    error: error.message,
  });
};
