import { test, expect, beforeEach } from "vitest";
// TCK: Versioning Suite
// Tests temporal versioning with composite PK (VersionKey).

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const versioningSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckVersionKeyed } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("insert creates entity with version key and version start date", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const entity = await repo.insert({ name: "V1" });

    expect(entity.id).toBeDefined();
    expect(entity.versionId).toBeDefined();
    expect(entity.versionStart).toBeInstanceOf(Date);
    expect(entity.versionEnd).toBeNull();
    expect(entity.name).toBe("V1");
  });

  test("update creates a new version row with new versionId", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const v1 = await repo.insert({ name: "V1" });
    const v1Id = v1.versionId;

    v1.name = "V2";
    const v2 = await repo.update(v1);

    expect(v2.id).toBe(v1.id);
    expect(v2.versionId).not.toBe(v1Id);
    expect(v2.name).toBe("V2");
  });

  test("findOne with composite key returns specific version", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const v1 = await repo.insert({ name: "V1" });

    const found = await repo.findOne({ id: v1.id, versionId: v1.versionId });
    expect(found).not.toBeNull();
    expect(found!.name).toBe("V1");
  });

  test("versions returns all versions of an entity", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const v1 = await repo.insert({ name: "V1" });

    v1.name = "V2";
    await repo.update(v1);

    const allVersions = await repo.versions({ id: v1.id });
    expect(allVersions.length).toBeGreaterThanOrEqual(2);
  });

  test("update closes previous version (sets versionEnd)", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const v1 = await repo.insert({ name: "V1" });
    const v1VersionId = v1.versionId;

    v1.name = "V2";
    await repo.update(v1);

    const allVersions = await repo.versions({ id: v1.id });
    const oldVersion = allVersions.find((v) => v.versionId === v1VersionId);

    expect(oldVersion).toBeDefined();
    expect(oldVersion!.versionEnd).toBeInstanceOf(Date);
  });

  test("versions returns all version rows with valid dates", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const v1 = await repo.insert({ name: "V1" });

    v1.name = "V2";
    const v2 = await repo.update(v1);

    v2.name = "V3";
    await repo.update(v2);

    const allVersions = await repo.versions({ id: v1.id });
    expect(allVersions.length).toBeGreaterThanOrEqual(3);

    // All version rows must have valid versionStart dates
    for (const version of allVersions) {
      expect(version.versionStart).toBeInstanceOf(Date);
    }
  });

  test("findOne by id only returns the current (open) version", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const v1 = await repo.insert({ name: "V1" });

    v1.name = "V2";
    await repo.update(v1);

    // findOne without versionId — should resolve to the open (current) row only
    const current = await repo.findOne({ id: v1.id });

    expect(current).not.toBeNull();
    expect(current!.versionEnd).toBeNull();
  });

  test("destroy removes the entity", async () => {
    const repo = getHandle().repository(TckVersionKeyed);
    const entity = await repo.insert({ name: "ToDestroy" });
    const entityId = entity.id;

    await repo.destroy(entity);

    // No open version should be found
    const found = await repo.findOne({ id: entityId });
    expect(found).toBeNull();

    // The destroyed version row itself must not appear in versions()
    const remaining = await repo.versions({ id: entityId });
    expect(remaining.every((v) => v.versionId !== entity.versionId)).toBe(true);
  });

  // P2-F04: find() multiple versioned entities returns only current
  test("find() with multiple versioned entities returns only the current version for each", async () => {
    const repo = getHandle().repository(TckVersionKeyed);

    const e1 = await repo.insert({ name: "Multi-E1-V1" });
    e1.name = "Multi-E1-V2";
    await repo.update(e1);

    const e2 = await repo.insert({ name: "Multi-E2-V1" });
    e2.name = "Multi-E2-V2";
    await repo.update(e2);

    const results = await repo.find();
    expect(results).toHaveLength(2);

    for (const r of results) {
      expect(r.versionEnd).toBeNull();
    }

    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["Multi-E1-V2", "Multi-E2-V2"]);
  });

  // Edge: pipe character in entity name stored/retrieved correctly
  test("entity with pipe character in name is stored and retrieved correctly", async () => {
    const repo = getHandle().repository(TckVersionKeyed);

    const entity = await repo.insert({ name: "pipe|in|name" });
    expect(entity.name).toBe("pipe|in|name");

    const found = await repo.findOne({ id: entity.id });
    expect(found).not.toBeNull();
    expect(found!.name).toBe("pipe|in|name");
  });
};
