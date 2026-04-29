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
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
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
    encryption: true,
    inheritance: { singleTable: true, joined: true },
    transactions: { rollback: true, savepoints: true },
    migrations: { lifecycle: true, generation: true },
  },
  async setup(entities: Array<Constructor<IEntity>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();
    const filename = join(tmpdir(), `proteus-tck-${randomUUID()}.db`);

    source = new ProteusSource({
      driver: "sqlite",
      filename,
      entities,
      logger,
      synchronize: true,
      amphora,
    });

    await source.connect();
    await source.setup();

    return {
      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
      },

      async clear() {
        // Disconnect, delete the file, reconnect with a fresh database
        const prevFilename = (source as any)._options?.filename ?? filename;
        await source.disconnect();

        try {
          await rm(prevFilename, { force: true });
        } catch {
          // Ignore cleanup errors
        }

        source = new ProteusSource({
          driver: "sqlite",
          filename: prevFilename,
          entities,
          logger,
          synchronize: true,
          amphora,
        });

        await source.connect();
        await source.setup();
      },

      async teardown() {
        const prevFilename = (source as any)._options?.filename ?? filename;
        await source.disconnect();

        try {
          await rm(prevFilename, { force: true });
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  },
};

describe("TCK: SQLite", () => {
  runTck(factory, () => source);
});
