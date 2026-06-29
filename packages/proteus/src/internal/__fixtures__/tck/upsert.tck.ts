import { test, expect, beforeEach } from "vitest";
// TCK: Upsert Suite
// Tests upsert (INSERT ON CONFLICT DO UPDATE) behavior.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import type { UpsertOptions } from "../../../types/index.js";

export const upsertSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  caps: TckCapabilities,
) => {
  const { TckSimpleUser, TckUniqueConstrained, TckUniqueComposite } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("upsert inserts when entity does not exist", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const entity = repo.create({ name: "UpsertNew", age: 25 });
    const result = await repo.upsert(entity);

    expect(result.id).toBeDefined();
    expect(result.name).toBe("UpsertNew");
    expect(result.age).toBe(25);
    expect(result.version).toBe(1);
  });

  test("upsert updates when entity already exists", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const inserted = await repo.insert({ name: "UpsertExist", age: 10 });

    inserted.name = "UpsertUpdated";
    inserted.age = 99;
    const result = await repo.upsert(inserted);

    expect(result.id).toBe(inserted.id);
    expect(result.name).toBe("UpsertUpdated");
    expect(result.age).toBe(99);
  });

  test("upsert does not create duplicates", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const inserted = await repo.insert({ name: "NoDup", age: 1 });

    inserted.name = "NoDup-v2";
    await repo.upsert(inserted);
    await repo.upsert(inserted);

    const count = await repo.count({ id: inserted.id });
    expect(count).toBe(1);
  });

  test("upsert returns entity with correct version after update", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const entity = repo.create({ name: "VersionCheck", age: 5 });
    const v1 = await repo.upsert(entity);
    expect(v1.version).toBe(1);

    v1.name = "VersionCheck2";
    const v2 = await repo.upsert(v1);
    expect(v2.version).toBe(2);
  });

  // A30: batch upsert

  test("batch upsert inserts multiple new entities", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const e1 = repo.create({ name: "BatchNew1", age: 10 });
    const e2 = repo.create({ name: "BatchNew2", age: 20 });

    const results = await repo.upsert([e1, e2]);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBeDefined();
    expect(results[1].id).toBeDefined();
    expect(results[0].id).not.toBe(results[1].id);
    expect(results[0].version).toBe(1);
    expect(results[1].version).toBe(1);
  });

  test("batch upsert updates existing entities", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const i1 = await repo.insert({ name: "BatchExist1", age: 1 });
    const i2 = await repo.insert({ name: "BatchExist2", age: 2 });

    i1.name = "BatchUpdated1";
    i2.name = "BatchUpdated2";
    const results = await repo.upsert([i1, i2]);

    expect(results).toHaveLength(2);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId[i1.id].name).toBe("BatchUpdated1");
    expect(byId[i2.id].name).toBe("BatchUpdated2");
  });

  // A31: upsert with conflictOn

  if (caps.upsertConflictColumns) {
    test("upsert with conflictOn uses specified columns", async () => {
      const repo = getHandle().repository(TckUniqueConstrained);
      await repo.insert({ email: "test@test.com", name: "Original" });

      const newEntity = repo.create({ email: "test@test.com", name: "Updated" });
      const options: UpsertOptions<typeof newEntity> = { conflictOn: ["email"] };

      await repo.upsert(newEntity, options);

      const count = await repo.count({ email: "test@test.com" });
      expect(count).toBe(1);

      const found = await repo.findOne({ email: "test@test.com" });
      expect(found!.name).toBe("Updated");
    });

    test("upsert with conflictOn on a composite (multi-word) unique resolves column names", async () => {
      // tenantId is a multi-word property; under a snake naming strategy it maps
      // to "tenant_id". conflictOn must be passed as property keys and resolved
      // once to the DB column names — regression for the double-resolution bug.
      const repo = getHandle().repository(TckUniqueComposite);
      await repo.insert({ tenantId: "t1", key: "k1", value: 1 });

      const options: UpsertOptions<{ tenantId: string; key: string; value: number }> = {
        conflictOn: ["tenantId", "key"],
      };
      await repo.upsert(repo.create({ tenantId: "t1", key: "k1", value: 2 }), options);

      const count = await repo.count({ tenantId: "t1", key: "k1" });
      expect(count).toBe(1);

      const found = await repo.findOne({ tenantId: "t1", key: "k1" });
      expect(found!.value).toBe(2);
    });
  }
};
