// Redis Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against a real Redis instance.
// Uses a random namespace prefix and SCAN+DEL for cleanup to avoid
// interfering with other Redis test files running in parallel.

import { randomBytes } from "node:crypto";
import type Redis from "ioredis";
import { createMockLogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { ProteusSource } from "../../classes/ProteusSource";
import { getEntityMetadata } from "../entity/metadata/get-entity-metadata";
import { resolveInheritanceHierarchies } from "../entity/metadata/resolve-inheritance";
import { isRedisCompatibleEntity } from "../drivers/redis/utils/validate-redis-entity";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora";
import { runTck } from "../__fixtures__/tck/run-tck";

jest.setTimeout(60_000);

let source: ProteusSource;
const namespace = `tck_${randomBytes(6).toString("hex")}`;
const amphora = createTckAmphora();

const factory: TckDriverFactory = {
  driver: "redis",
  capabilities: {
    softDelete: true,
    expiry: true,
    versioning: false,
    cursor: true,
    lazyLoading: true,
    atomicIncrements: true,
    queryBuilder: true,
    uniqueEnforcement: false,
    referentialIntegrity: false,
    encryption: true,
    inheritance: { singleTable: true, joined: false },
    transactions: { rollback: false, savepoints: false },
    migrations: { lifecycle: false, generation: false },
  },
  async setup(entities: Array<Constructor<IEntity>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();

    // Resolve inheritance hierarchies BEFORE building entity metadata so the
    // metadata cache is populated with inheritance-aware data (e.g. single-table
    // field merging, discriminator filters, polymorphic children map).
    const inheritanceMap = resolveInheritanceHierarchies(entities);

    // Filter out entities with decorators Redis doesn't support:
    // @Unique, @VersionKeyField/@VersionStartDateField/@VersionEndDateField,
    // @Check, @Computed, @EmbeddedList, @Index, joined inheritance
    const compatible = entities.filter((target) => {
      const metadata = getEntityMetadata(
        target,
        inheritanceMap.size > 0 ? inheritanceMap : undefined,
      );
      return isRedisCompatibleEntity(metadata);
    });

    source = new ProteusSource({
      driver: "redis",
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
      entities: compatible,
      logger,
      namespace,
      amphora,
    });

    await source.connect();
    await source.setup();

    return {
      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      async clear() {
        const client = await source.client<Redis>();
        const prefix = `${namespace}:`;
        let cursor = "0";
        do {
          const [next, keys] = await client.scan(
            cursor,
            "MATCH",
            `${prefix}*`,
            "COUNT",
            1000,
          );
          cursor = next;
          if (keys.length > 0) {
            await client.del(...keys);
          }
        } while (cursor !== "0");
      },

      async teardown() {
        const client = await source.client<Redis>();
        const prefix = `${namespace}:`;
        let cursor = "0";
        do {
          const [next, keys] = await client.scan(
            cursor,
            "MATCH",
            `${prefix}*`,
            "COUNT",
            1000,
          );
          cursor = next;
          if (keys.length > 0) {
            await client.del(...keys);
          }
        } while (cursor !== "0");
        await source.disconnect();
      },
    };
  },
};

describe("TCK: Redis", () => {
  runTck(factory, () => source);
});
