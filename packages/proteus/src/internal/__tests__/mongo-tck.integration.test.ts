// MongoDB Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against a real MongoDB 8 replica set.
// Uses a dedicated database for isolation; teardown drops all collections.

import { randomBytes } from "node:crypto";
import { createMockLogger } from "@lindorm/logger";
import { MongoClient, type Db } from "mongodb";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { ProteusSource } from "../../classes/ProteusSource";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora";
import { runTck } from "../__fixtures__/tck/run-tck";

jest.setTimeout(120_000);

const MONGO_DB = `tck_${randomBytes(6).toString("hex")}`;
const MONGO_URL =
  process.env["MONGO_URL"] ??
  `mongodb://localhost:27017/${MONGO_DB}?replicaSet=rs0&directConnection=true`;

let source: ProteusSource;
const amphora = createTckAmphora();

const factory: TckDriverFactory = {
  driver: "mongo",
  capabilities: {
    softDelete: true,
    expiry: true,
    versioning: true,
    cursor: true,
    lazyLoading: true,
    atomicIncrements: true,
    queryBuilder: true,
    uniqueEnforcement: true,
    referentialIntegrity: false,
    encryption: true,
    inheritance: { singleTable: true, joined: false },
    transactions: { rollback: true, savepoints: false },
    migrations: { lifecycle: true, generation: true },
  },
  async setup(entities: Array<Constructor<IEntity>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();

    // Wait for MongoDB replica set to be ready (container may still be initializing)
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const probe = new MongoClient(MONGO_URL, {
          serverSelectionTimeoutMS: 2000,
          connectTimeoutMS: 2000,
        });
        await probe.connect();
        await probe.db().command({ ping: 1 });
        await probe.close();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    source = new ProteusSource({
      driver: "mongo",
      url: MONGO_URL,
      synchronize: true,
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
        // Use the driver's own Db instance to ensure we hit the same database
        const db = await source.client<Db>();
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
          if (col.name.startsWith("system.")) continue;
          await db.collection(col.name).deleteMany({});
        }
      },

      async teardown() {
        try {
          const db = await source.client<Db>();
          await db.dropDatabase();
        } catch {
          // Ignore errors during teardown
        }
        await source.disconnect();
      },
    };
  },
};

describe("TCK: MongoDB", () => {
  runTck(factory, () => source);
});
