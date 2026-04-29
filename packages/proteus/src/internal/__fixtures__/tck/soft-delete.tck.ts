import { test, it, expect, beforeEach } from "vitest";
// TCK: Soft Delete Suite
// Tests soft-delete lifecycle: softDestroy, find excludes, restore re-includes.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const softDeleteSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckSoftDeletable } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("softDestroy sets deletedAt and excludes from find", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "SoftDelete1" });

    await repo.softDestroy(entity);

    const found = await repo.find();
    expect(found).toHaveLength(0);
  });

  test("softDestroy entity is found with withDeleted option", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "SoftDelete2" });

    await repo.softDestroy(entity);

    const found = await repo.find(undefined, { withDeleted: true });
    expect(found).toHaveLength(1);
    expect(found[0].deletedAt).toBeInstanceOf(Date);
  });

  test("restore un-deletes a soft-deleted entity", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "SoftDelete3" });

    await repo.softDestroy(entity);

    const beforeRestore = await repo.find();
    expect(beforeRestore).toHaveLength(0);

    await repo.restore({ id: entity.id });

    const afterRestore = await repo.find();
    expect(afterRestore).toHaveLength(1);
    expect(afterRestore[0].deletedAt).toBeNull();
  });

  test("softDelete by criteria soft-deletes matching entities", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    await repo.insert({ name: "Keep" });
    await repo.insert({ name: "Remove" });
    await repo.insert({ name: "Remove" });

    await repo.softDelete({ name: "Remove" });

    const visible = await repo.find();
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe("Keep");
  });

  test("count excludes soft-deleted entities", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const e1 = await repo.insert({ name: "A" });
    await repo.insert({ name: "B" });

    await repo.softDestroy(e1);

    const count = await repo.count();
    expect(count).toBe(1);
  });

  test("exists excludes soft-deleted entities", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "Ghost" });

    await repo.softDestroy(entity);

    const result = await repo.exists({ name: "Ghost" });
    expect(result).toBe(false);
  });

  test("findOne excludes soft-deleted entities", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "Invisible" });

    await repo.softDestroy(entity);

    const found = await repo.findOne({ id: entity.id });
    expect(found).toBeNull();
  });

  test("findOne with withDeleted finds soft-deleted entity", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "Visible" });

    await repo.softDestroy(entity);

    const found = await repo.findOne({ id: entity.id }, { withDeleted: true });
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Visible");
  });

  // A22: withDeleted on count must include soft-deleted rows.
  test("count with withDeleted includes soft-deleted", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const e1 = await repo.insert({ name: "CountDeleted1" });
    await repo.insert({ name: "CountDeleted2" });

    await repo.softDestroy(e1);

    const count = await repo.count(undefined, { withDeleted: true });
    expect(count).toBe(2);
  });

  // A23: Calling softDestroy on an already-soft-deleted entity must be idempotent.
  test("softDestroy on already-soft-deleted entity is idempotent", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "Idempotent" });

    await repo.softDestroy(entity);
    await expect(repo.softDestroy(entity)).resolves.not.toThrow();
  });

  // FIX-2: save() on a soft-deleted entity must take the update path (not insert).
  // The exists() check inside saveOne() must use withDeleted:true so it finds the
  // soft-deleted row and goes directly to updateOne() instead of trying to insert.
  test("save() on a soft-deleted entity updates rather than throwing duplicate key", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "SoftSave" });
    expect(entity.version).toBe(1);

    // Soft-delete it so it's invisible to normal queries
    await repo.softDestroy(entity);

    const stillDeleted = await repo.findOne({ id: entity.id });
    expect(stillDeleted).toBeNull();

    // Calling save() with the same entity (known id) should update, not insert
    entity.name = "SoftSave Updated";
    const saved = await repo.save(entity);

    // save() must succeed and bump the version
    expect(saved.id).toBe(entity.id);
    expect(saved.version).toBe(entity.version + 1);
    expect(saved.name).toBe("SoftSave Updated");
  });

  test("save() with new plain object inserts on unknown id (unrelated soft-delete regression)", async () => {
    const repo = getHandle().repository(TckSoftDeletable);
    const entity = await repo.insert({ name: "OriginalEntity" });

    await repo.softDestroy(entity);

    // A completely different object with a new id should still insert cleanly
    const saved = await repo.save({ name: "BrandNew" });
    expect(saved.id).not.toBe(entity.id);
    expect(saved.version).toBe(1);
  });

  // P1-F04: increment must not apply to soft-deleted rows
  test("increment does not affect soft-deleted entities", async () => {
    const repo = getHandle().repository(TckSoftDeletable);

    const alive = await repo.insert({ name: "IncrAlive", score: 10 });
    const dead = await repo.insert({ name: "IncrDead", score: 10 });

    await repo.softDestroy(dead);

    // increment targets both by name criteria — must only touch alive row
    await repo.increment({ name: { $in: ["IncrAlive", "IncrDead"] } }, "score", 5);

    // alive entity should now be 15
    const foundAlive = await repo.findOne({ id: alive.id });
    expect(foundAlive!.score).toBe(15);

    // soft-deleted entity: fetch with withDeleted to verify untouched
    const foundDead = await repo.findOne({ id: dead.id }, { withDeleted: true });
    expect(foundDead!.score).toBe(10);
  });
};
