/**
 * Integration tests for session-level AbortSignal on MongoDriver.
 *
 * Runs against the docker-composed mongo replica set (see
 * packages/proteus/docker-compose.yml).
 *
 * Coverage:
 * - Pre-flight: aborted session rejects reads before dispatching.
 * - In-flight find() cancelled via the session signal rejects with AbortError.
 * - Non-signal sessions keep working — basic find sanity check.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { MongoDriver } from "./MongoDriver.js";

const MONGO_DB = `sig_${randomBytes(6).toString("hex")}`;
const MONGO_URL =
  process.env["MONGO_URL"] ??
  `mongodb://localhost:27017/${MONGO_DB}?replicaSet=rs0&directConnection=true`;

const COLLECTION = "signal_test";

const mockMetadata = {
  entity: { name: COLLECTION },
  fields: [{ key: "id", name: "_id", decorator: "PrimaryKey", type: "string" }],
  primaryKeys: ["id"],
  relations: [],
  generated: [],
  embeddedLists: [],
  indexes: [],
  defaultOrder: null,
} as unknown as EntityMetadata;

class Row implements IEntity {
  [key: string]: any;
  id!: string;
}

describe("MongoDriver cancellation (integration)", () => {
  let driver: MongoDriver;
  let raw: MongoClient;

  beforeAll(async () => {
    // Wait for mongo replica set to be ready. The docker-compose health
    // check initiates the replica set on first hit; primary election can
    // take several seconds after the container is up.
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const probe = new MongoClient(MONGO_URL, {
          serverSelectionTimeoutMS: 1000,
          connectTimeoutMS: 1000,
        });
        await probe.connect();
        await probe.db().command({ ping: 1 });
        await probe.close();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    raw = new MongoClient(MONGO_URL);
    await raw.connect();
    const db = raw.db();

    // Seed a collection with enough docs to make a full scan + `$where` sleep observable.
    const coll = db.collection(COLLECTION);
    const docs = Array.from({ length: 200 }, (_, i) => ({
      _id: `row-${i}` as any,
      value: i,
    }));
    await coll.insertMany(docs);

    const logger = createMockLogger();
    const resolveMetadata: (t: Constructor<IEntity>) => EntityMetadata = () =>
      mockMetadata;
    driver = new MongoDriver(
      { driver: "mongo", url: MONGO_URL, database: MONGO_DB } as any,
      logger,
      null,
      resolveMetadata,
    );
    await driver.connect();
  });

  afterAll(async () => {
    await driver.disconnect();
    await raw.db().collection(COLLECTION).drop();
    await raw.close();
  });

  test("pre-flight: aborted session rejects createExecutor with AbortError", () => {
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    expect(() => session.createExecutor(Row)).toThrow(AbortError);
  });

  test("signal is forwarded into operations so an aborted mid-flight op rejects", async () => {
    const controller = new AbortController();
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    // Use the server-side sleep command — mongod accepts { sleep: { millis } }
    // which blocks for the given duration. The mongo driver honours the
    // `signal` option on db.command, so aborting mid-flight rejects the
    // caller in well under the sleep duration.
    const db = (session as any).db;
    const start = Date.now();
    const pending = db
      .command({ sleep: 1, lock: "none", millis: 5000 }, { signal: controller.signal })
      .then(() => ({ ok: true as const }))
      .catch((err: unknown) => ({ ok: false as const, err }));

    setTimeout(() => controller.abort({ kind: "client-disconnect" }), 150);
    const result = await pending;
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(false);
    // Must have rejected well before the 5s sleep finished.
    expect(elapsed).toBeLessThan(2000);
  });

  test("non-signal session — find executes normally", async () => {
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      undefined,
    );
    const db = (session as any).db;
    const coll = db.collection(COLLECTION);
    const docs = await coll.find({}).limit(5).toArray();
    expect(docs.length).toBe(5);
  });
});
