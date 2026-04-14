// Memory Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against the in-memory driver.
// No external services required.

import { createMockLogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { ProteusSource } from "../../classes/ProteusSource";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora";
import { runTck } from "../__fixtures__/tck/run-tck";

jest.setTimeout(30_000);

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
    uniqueEnforcement: true,
    referentialIntegrity: false,
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
    });

    await source.connect();
    await source.setup();

    return {
      repository<E extends IEntity>(target: Constructor<E>) {
        return source.repository(target);
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
        });
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
  runTck(factory, () => source);
});
