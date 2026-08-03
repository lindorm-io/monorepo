// Memory Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against the in-memory driver.
// No external services required.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Constructor, Dict } from "@lindorm/types";
import type { IEntity } from "../../interfaces/index.js";
import type { MemoryStore } from "../drivers/memory/types/memory-store.js";
import { ProteusSource } from "../../classes/ProteusSource.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import {
  createTckAmphora,
  TCK_ENCRYPTION,
} from "../__fixtures__/tck/create-tck-amphora.js";
import { stageTckEncryptions } from "../__fixtures__/tck/stage-tck-encryptions.js";
import { resolveTableKey } from "../drivers/memory/utils/memory-referential-integrity.js";
import { resolveTckMetadata } from "../__fixtures__/tck/resolve-tck-metadata.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { describe, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

let source: ProteusSource;
const amphora = createTckAmphora();

const factory: TckDriverFactory = {
  driver: "memory",
  capabilities: {
    softDelete: true,
    expiry: true,
    versioning: true,
    cursor: true,
    lazyLoading: true,
    embeddedLists: true,
    atomicIncrements: true,
    queryBuilder: true,
    queryBuilderIncludes: false,
    uniqueEnforcement: true,
    referentialIntegrity: true,
    checkConstraints: false,
    bigintColumns: true,
    decimalColumns: true,
    binaryColumns: true,
    typedJson: true,
    bigintIdentity: true,
    upsertConflictColumns: true,
    encryption: true,
    inheritance: { singleTable: true, joined: true },
    transactions: { rollback: true, savepoints: true },
    migrations: { lifecycle: false, generation: false },
  },
  async setup(entities: Array<Constructor<IEntity>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();

    source = new ProteusSource({
      driver: "memory",
      entities,
      logger,
      amphora,
      encryption: TCK_ENCRYPTION,
    });

    stageTckEncryptions(source, entities);

    await source.connect();
    await source.setup();

    return {
      amphora,

      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      // The memory driver has no client to acquire, so the store is reached
      // through the driver instance. Test-only reach-in: exposing the store on
      // the public surface just to assert on it would be worse.
      async readRawRows<E extends IEntity>(target: Constructor<E>) {
        const metadata = resolveTckMetadata(source, target as Constructor<IEntity>);
        const store = (source as any)._driver.store as MemoryStore;
        const table = store.tables.get(resolveTableKey(metadata, source.namespace));
        return [...(table?.values() ?? [])] as Array<Dict>;
      },

      async clear() {
        // Disconnect and reconnect to reset the in-memory store
        await source.disconnect();
        // Re-create source to get a fresh store
        source = new ProteusSource({
          driver: "memory",
          entities,
          logger,
          amphora,
          encryption: TCK_ENCRYPTION,
        });
        stageTckEncryptions(source, entities);
        await source.connect();
        await source.setup();
      },

      async teardown() {
        await source.disconnect();
      },
    };
  },
};

describe("TCK: Memory", () => {
  // One strategy per driver — memory proves `none` (default). See ../__fixtures__/tck/NAMING.md.
  runTck(factory, () => source);
});
