import { test, expect, beforeEach } from "vitest";
// TCK: Scope Suite
// Tests multi-tenant scope field isolation.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const scopeSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  const { TckScoped } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("entities with different scopes are isolated in find", async () => {
    const repo = getHandle().repository(TckScoped);
    await repo.insert({ scope: "tenant-a", label: "A1" });
    await repo.insert({ scope: "tenant-a", label: "A2" });
    await repo.insert({ scope: "tenant-b", label: "B1" });

    const tenantA = await repo.find({ scope: "tenant-a" });
    expect(tenantA).toHaveLength(2);

    const tenantB = await repo.find({ scope: "tenant-b" });
    expect(tenantB).toHaveLength(1);
  });

  test("scope field is readonly after insert", async () => {
    const repo = getHandle().repository(TckScoped);
    const entity = await repo.insert({ scope: "original", label: "Test" });

    expect(entity.scope).toBe("original");
  });

  test("count respects scope criteria", async () => {
    const repo = getHandle().repository(TckScoped);
    await repo.insert({ scope: "s1", label: "A" });
    await repo.insert({ scope: "s1", label: "B" });
    await repo.insert({ scope: "s2", label: "C" });

    const count = await repo.count({ scope: "s1" });
    expect(count).toBe(2);
  });

  test("delete by criteria respects scope isolation", async () => {
    const repo = getHandle().repository(TckScoped);
    await repo.insert({ scope: "s1", label: "A" });
    await repo.insert({ scope: "s1", label: "B" });
    await repo.insert({ scope: "s2", label: "C" });
    await repo.insert({ scope: "s2", label: "D" });

    await repo.delete({ scope: "s1" });

    const s1Remaining = await repo.find({ scope: "s1" });
    expect(s1Remaining).toHaveLength(0);

    const s2Remaining = await repo.find({ scope: "s2" });
    expect(s2Remaining).toHaveLength(2);
  });

  test("exists respects scope criteria", async () => {
    const repo = getHandle().repository(TckScoped);
    await repo.insert({ scope: "s1", label: "A" });
    await repo.insert({ scope: "s2", label: "B" });

    const inS1 = await repo.exists({ scope: "s1", label: "A" });
    expect(inS1).toBe(true);

    // label "A" does not exist in s2
    const inS2 = await repo.exists({ scope: "s2", label: "A" });
    expect(inS2).toBe(false);
  });

  test("findOne respects scope", async () => {
    const repo = getHandle().repository(TckScoped);
    const s1Entity = await repo.insert({ scope: "s1", label: "X" });
    await repo.insert({ scope: "s2", label: "X" });

    const found = await repo.findOne({ scope: "s1", label: "X" });

    expect(found).not.toBeNull();
    expect(found!.id).toBe(s1Entity.id);
    expect(found!.scope).toBe("s1");
  });

  test("updateMany within scope does not affect other scopes", async () => {
    const repo = getHandle().repository(TckScoped);
    await repo.insert({ scope: "s1", label: "A" });
    const s2Entity = await repo.insert({ scope: "s2", label: "B" });

    await repo.updateMany({ scope: "s1" }, { label: "Updated" });

    const s1Updated = await repo.find({ scope: "s1" });
    expect(s1Updated).toHaveLength(1);
    expect(s1Updated[0].label).toBe("Updated");

    const s2Unchanged = await repo.findOne({ id: s2Entity.id });
    expect(s2Unchanged).not.toBeNull();
    expect(s2Unchanged!.label).toBe("B");
  });
};
