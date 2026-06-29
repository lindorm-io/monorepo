// SQLite Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against the SQLite driver.
// No external services required — uses a temp file database.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { MemoryCacheAdapter } from "../../classes/MemoryCacheAdapter.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import type { NamingStrategy, ProteusCacheConfig } from "../../types/source-options.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { describe, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

let source: ProteusSource;
const amphora = createTckAmphora();

const factory: TckDriverFactory = {
  driver: "sqlite",
  capabilities: {
    softDelete: true,
    expiry: true,
    versioning: true,
    cursor: true,
    lazyLoading: true,
    embeddedLists: true,
    atomicIncrements: true,
    queryBuilder: true,
    uniqueEnforcement: true,
    referentialIntegrity: true,
    checkConstraints: true,
    richColumnTypes: true,
    upsertConflictColumns: true,
    encryption: true,
    inheritance: { singleTable: true, joined: true },
    transactions: { rollback: true, savepoints: true },
    migrations: { lifecycle: true, generation: true },
  },
  async setup(
    entities: Array<Constructor<IEntity>>,
    naming: NamingStrategy = "none",
    cache = false,
  ): Promise<TckDriverHandle> {
    const logger = createMockLogger();
    const filename = join(tmpdir(), `proteus-tck-${naming}-${randomUUID()}.db`);

    // Fresh cache adapter per source build so each (re)connect starts cold.
    const cacheConfig = (): ProteusCacheConfig | undefined =>
      cache ? { adapter: new MemoryCacheAdapter(), ttl: "5 minutes" } : undefined;

    const makeSource = (): ProteusSource =>
      new ProteusSource({
        driver: "sqlite",
        filename,
        entities,
        logger,
        synchronize: true,
        naming,
        cache: cacheConfig(),
        amphora,
      });

    source = makeSource();

    await source.connect();
    await source.setup();

    return {
      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      async clear() {
        // Disconnect, delete the file, reconnect with a fresh database
        await source.disconnect();

        try {
          await rm(filename, { force: true });
        } catch {
          // Ignore cleanup errors
        }

        source = makeSource();

        await source.connect();
        await source.setup();
      },

      async teardown() {
        await source.disconnect();

        try {
          await rm(filename, { force: true });
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  },
};

// A cache-enabled view of the same factory; exercises the CachingRepository
// layer across the full behavioural suite (the cache is driver-agnostic, so
// validating it once on the in-process sqlite driver covers the layer).
const cachedFactory: TckDriverFactory = {
  ...factory,
  setup: (entities, naming = "none") => factory.setup(entities, naming, true),
};

describe("TCK: SQLite", () => {
  runTck(factory, () => source, ["none", "snake", "camel"]);
});

describe("TCK: SQLite (cached)", () => {
  runTck(cachedFactory, () => source, ["none"]);
});
