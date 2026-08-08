// ⭐ What does a data-audit record ACTUALLY contain for an ordinary update?
//
// The audited flow is: caller loads a row, mutates one field, calls
// `repository.update(entity)`. Proteus fires `entity:after-update`, the pylon
// listener diffs `oldEntity` against `entity`, publishes a DataAuditChange, and
// the consumer writes it to `DataAuditLog.changes`.
//
// Every hop here is the real thing — a real proteus source (sqlite on disk-less
// `:memory:`, and the memory driver), a real iris source, the production
// `setupDataAuditListeners` / `setupDataAuditConsumer` wiring that
// `Pylon.loadAudit` itself calls. Nothing invokes a consumer handler by hand:
// that is precisely how this feature stayed broken while its tests stayed
// green.

import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  CreateDateField,
  Entity,
  Field,
  Namespace,
  PrimaryKeyField,
  ProteusSource,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";
import { afterEach, describe, expect, test } from "vitest";
import { DataAuditLog } from "../../entities/DataAuditLog.js";
import { DataAuditChange } from "../../messages/DataAuditChange.js";
import { setupDataAuditConsumer } from "../consumers/setup-data-audit-consumer.js";
import { setupDataAuditListeners } from "./setup-data-audit-listeners.js";

@Namespace("pylon")
@Entity()
class AuditedThing {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Field("integer")
  count!: number;
}

// Consumers are fire-and-forget behind an `await publish`, so the row lands a
// tick or two later. Poll rather than sleep a fixed amount.
const waitFor = async (predicate: () => Promise<boolean> | boolean): Promise<void> => {
  for (let i = 0; i < 200; i++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const sources: Array<ProteusSource> = [];

const createDb = async (driver: "sqlite" | "memory"): Promise<ProteusSource> => {
  const source = new ProteusSource(
    driver === "sqlite"
      ? {
          driver: "sqlite",
          filename: ":memory:",
          entities: [AuditedThing, DataAuditLog],
          logger: createMockLogger(),
          synchronize: true,
        }
      : {
          driver: "memory",
          entities: [AuditedThing, DataAuditLog],
          logger: createMockLogger(),
        },
  );

  sources.push(source);

  await source.connect();
  await source.setup();

  return source;
};

afterEach(async () => {
  while (sources.length) {
    await sources.pop()?.disconnect();
  }
});

describe.each(["sqlite", "memory"] as const)("data audit diff (%s)", (driver) => {
  const setup = async (): Promise<{ db: ProteusSource; bus: any }> => {
    const logger = createMockLogger();
    const db = await createDb(driver);
    const bus = await createMockIrisSource({ messages: [DataAuditChange] });

    // Exactly what Pylon.loadAudit does when `audit.entities` is non-empty.
    await setupDataAuditListeners(db, bus, [AuditedThing], logger);
    await setupDataAuditConsumer(bus, db, logger);

    return { db, bus };
  };

  const seed = async (db: ProteusSource): Promise<AuditedThing> =>
    db.repository(AuditedThing).insert(
      db.repository(AuditedThing).create({
        id: "thing-1",
        name: "original",
        count: 1,
      }),
    );

  const auditedUpdate = async (db: ProteusSource): Promise<DataAuditLog> => {
    const repo = db.repository(DataAuditLog);

    await waitFor(async () => (await repo.find({ action: "update" })).length > 0);

    const [row] = await repo.find({ action: "update" });

    expect(row).toBeDefined();

    return row;
  };

  // The load → mutate → update sequence every consumer of proteus writes.
  test("should record the changed field, with its before and after values", async () => {
    const { db } = await setup();
    await seed(db);

    const loaded = await db.repository(AuditedThing).findOne({ id: "thing-1" });
    loaded!.name = "renamed";
    await db.repository(AuditedThing).update(loaded!);

    const row = await auditedUpdate(db);

    expect(row.changes).toMatchObject({
      name: { from: "original", to: "renamed" },
    });
  });

  // Pipeline-managed columns move on EVERY update, so they can never be the
  // evidence that the audit works — a diff holding only these is the shape of
  // the failure, not of a record.
  test("should not record ONLY the pipeline-managed columns", async () => {
    const { db } = await setup();
    await seed(db);

    const loaded = await db.repository(AuditedThing).findOne({ id: "thing-1" });
    loaded!.count = 42;
    await db.repository(AuditedThing).update(loaded!);

    const row = await auditedUpdate(db);

    expect(Object.keys(row.changes ?? {}).sort()).not.toEqual(["updatedAt", "version"]);
    expect(row.changes).toMatchObject({ count: { from: 1, to: 42 } });
  });

  // A field left alone must NOT appear in the diff — otherwise "what changed"
  // is unreadable even when the changed field is present.
  test("should leave an untouched field out of the diff", async () => {
    const { db } = await setup();
    await seed(db);

    const loaded = await db.repository(AuditedThing).findOne({ id: "thing-1" });
    loaded!.name = "renamed";
    await db.repository(AuditedThing).update(loaded!);

    const row = await auditedUpdate(db);

    expect(row.changes).not.toHaveProperty("count");
  });
});
