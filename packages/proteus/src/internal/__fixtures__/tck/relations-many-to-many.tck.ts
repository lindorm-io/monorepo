import { test, it, expect, beforeEach } from "vitest";
// TCK: Relations ManyToMany Suite
// Tests ManyToMany: TckLeft (has join table) <-> TckRight.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const relationsManyToManySuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckLeft, TckRight } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("save left with rights creates join table entries", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "R1" });
    const r2 = await rightRepo.insert({ label: "R2" });

    const saved = await leftRepo.save({ label: "L1", rights: [r1, r2] });

    // Verify via find — RETURNING doesn't include relation objects
    const found = await leftRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.rights).toHaveLength(2);
  });

  test("inverse side loads related entities", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "R1" });
    await leftRepo.save({ label: "L1", rights: [r1] });
    await leftRepo.save({ label: "L2", rights: [r1] });

    const found = await rightRepo.findOne({ id: r1.id });
    expect(found).not.toBeNull();
    expect(found!.lefts).toHaveLength(2);
  });

  test("entity with no relations has empty array", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const left = await leftRepo.insert({ label: "Lonely" });

    const found = await leftRepo.findOne({ id: left.id });
    expect(found).not.toBeNull();
    expect(found!.rights).toEqual([]);
  });

  test("updating relation set replaces previous associations", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "R1" });
    const r2 = await rightRepo.insert({ label: "R2" });
    const r3 = await rightRepo.insert({ label: "R3" });

    const saved = await leftRepo.save({ label: "L1", rights: [r1, r2] });

    // Find to get the entity with relations loaded
    const left = await leftRepo.findOne({ id: saved.id });
    expect(left).not.toBeNull();

    left!.rights = [r2, r3];
    await leftRepo.save(left!);

    const updated = await leftRepo.findOne({ id: saved.id });
    expect(updated).not.toBeNull();
    expect(updated!.rights).toHaveLength(2);
    const labels = updated!.rights.map((r) => r.label).sort();
    expect(labels).toEqual(["R2", "R3"]);
  });

  test("cascade save with mixed new and existing entities", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    // r1 is persisted (version > 0), r2 is new (version = 0)
    const r1 = await rightRepo.insert({ label: "Existing" });
    const r2 = rightRepo.create({ label: "New" });

    const saved = await leftRepo.save({ label: "L1", rights: [r1, r2] });

    const found = await leftRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.rights).toHaveLength(2);
    const labels = found!.rights.map((r) => r.label).sort();
    expect(labels).toEqual(["Existing", "New"]);
  });

  test("cascade save creates unsaved related entities", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = rightRepo.create({ label: "NewR1" });
    const r2 = rightRepo.create({ label: "NewR2" });

    const saved = await leftRepo.save({ label: "L1", rights: [r1, r2] });

    // Verify via find — RETURNING doesn't include relation objects
    const found = await leftRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.rights).toHaveLength(2);

    const allRights = await rightRepo.find();
    expect(allRights).toHaveLength(2);
  });

  test("clearing relation array removes all join table entries", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "R1" });
    const r2 = await rightRepo.insert({ label: "R2" });

    const saved = await leftRepo.save({ label: "L1", rights: [r1, r2] });

    // Reload to get the entity with relations loaded
    const left = await leftRepo.findOne({ id: saved.id });
    expect(left).not.toBeNull();
    expect(left!.rights).toHaveLength(2);

    // Clear all relations and save
    left!.rights = [];
    await leftRepo.save(left!);

    // Verify left now has no relations
    const updated = await leftRepo.findOne({ id: saved.id });
    expect(updated).not.toBeNull();
    expect(updated!.rights).toHaveLength(0);

    // Verify both rights still exist in DB
    const foundR1 = await rightRepo.findOne({ id: r1.id });
    const foundR2 = await rightRepo.findOne({ id: r2.id });
    expect(foundR1).not.toBeNull();
    expect(foundR2).not.toBeNull();
  });

  test("destroy entity cleans up join table entries", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "R1" });
    const r2 = await rightRepo.insert({ label: "R2" });

    const saved = await leftRepo.save({ label: "L1", rights: [r1, r2] });

    // Destroy the left entity
    await leftRepo.destroy(saved);

    // Verify both rights still exist in DB
    const foundR1 = await rightRepo.findOne({ id: r1.id });
    const foundR2 = await rightRepo.findOne({ id: r2.id });
    expect(foundR1).not.toBeNull();
    expect(foundR2).not.toBeNull();

    // Create a new left and verify it has no inherited relations to old rights
    const newLeft = await leftRepo.save({ label: "L2", rights: [] });
    const foundNewLeft = await leftRepo.findOne({ id: newLeft.id });
    expect(foundNewLeft).not.toBeNull();
    expect(foundNewLeft!.rights).toHaveLength(0);
  });

  // ─── Batch isolation: multiple parents with distinct rights ────────────────
  test("find() returns correct rights for each left when multiple lefts exist", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const rA = await rightRepo.insert({ label: "BatchA" });
    const rB = await rightRepo.insert({ label: "BatchB" });
    const rC = await rightRepo.insert({ label: "BatchC" });

    const l1 = await leftRepo.save({ label: "BatchL1", rights: [rA, rB] });
    const l2 = await leftRepo.save({ label: "BatchL2", rights: [rC] });

    const allLefts = await leftRepo.find(undefined, { order: { label: "ASC" } });
    expect(allLefts).toHaveLength(2);

    const foundL1 = allLefts.find((l) => l.id === l1.id)!;
    const foundL2 = allLefts.find((l) => l.id === l2.id)!;

    const l1Labels = foundL1.rights.map((r) => r.label).sort();
    const l2Labels = foundL2.rights.map((r) => r.label).sort();

    expect(l1Labels).toEqual(["BatchA", "BatchB"]);
    expect(l2Labels).toEqual(["BatchC"]);
  });

  // ─── Inverse batch isolation: multiple rights with distinct lefts ──────────
  test("find() returns correct lefts for each right when multiple rights exist", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "InvBatchR1" });
    const r2 = await rightRepo.insert({ label: "InvBatchR2" });

    await leftRepo.save({ label: "InvBatchL1", rights: [r1] });
    await leftRepo.save({ label: "InvBatchL2", rights: [r2] });
    await leftRepo.save({ label: "InvBatchL3", rights: [r1, r2] });

    const allRights = await rightRepo.find(undefined, { order: { label: "ASC" } });
    expect(allRights).toHaveLength(2);

    const foundR1 = allRights.find((r) => r.id === r1.id)!;
    const foundR2 = allRights.find((r) => r.id === r2.id)!;

    expect(foundR1.lefts).toHaveLength(2);
    expect(foundR2.lefts).toHaveLength(2);

    const r1LeftLabels = foundR1.lefts.map((l) => l.label).sort();
    expect(r1LeftLabels).toEqual(["InvBatchL1", "InvBatchL3"]);

    const r2LeftLabels = foundR2.lefts.map((l) => l.label).sort();
    expect(r2LeftLabels).toEqual(["InvBatchL2", "InvBatchL3"]);
  });

  // ─── Deduplication: same entity twice in relation array ─────────────────────
  test("saving the same right twice in rights array deduplicates join table entries", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "DupRight" });

    const saved = await leftRepo.save({ label: "DupLeft", rights: [r1, r1] });

    const found = await leftRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.rights).toHaveLength(1);
    expect(found!.rights[0].id).toBe(r1.id);
  });

  // ─── Idempotent re-save ───────────────────────────────────────────────────
  test("re-saving entity with unchanged M2M relations does not duplicate join rows", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "IdemRight" });
    const saved = await leftRepo.save({ label: "IdemLeft", rights: [r1] });

    const reloaded = await leftRepo.findOne({ id: saved.id });
    expect(reloaded).not.toBeNull();
    await leftRepo.save(reloaded!);

    const afterResave = await leftRepo.findOne({ id: saved.id });
    expect(afterResave).not.toBeNull();
    expect(afterResave!.rights).toHaveLength(1);
  });

  // ─── Partial update: remove some, keep some, add new ───────────────────────
  test("partial M2M update removes dropped, keeps existing, adds new in one save", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const rKeep = await rightRepo.insert({ label: "Keep" });
    const rRemove = await rightRepo.insert({ label: "Remove" });
    const rNew = await rightRepo.insert({ label: "AddNew" });

    const saved = await leftRepo.save({ label: "PartialLeft", rights: [rKeep, rRemove] });
    const loaded = await leftRepo.findOne({ id: saved.id });
    expect(loaded!.rights).toHaveLength(2);

    loaded!.rights = [rKeep, rNew];
    await leftRepo.save(loaded!);

    const updated = await leftRepo.findOne({ id: saved.id });
    expect(updated).not.toBeNull();
    const labels = updated!.rights.map((r) => r.label).sort();
    expect(labels).toEqual(["AddNew", "Keep"]);
  });

  // ─── Destroy owning side → inverse shows no ghost relations ──────────
  test("after destroying owning-side entity, inverse side shows no ghost relations", async () => {
    const leftRepo = getHandle().repository(TckLeft);
    const rightRepo = getHandle().repository(TckRight);

    const r1 = await rightRepo.insert({ label: "GhostCheck" });
    const left = await leftRepo.save({ label: "GhostLeft", rights: [r1] });

    const beforeDestroy = await rightRepo.findOne({ id: r1.id });
    expect(beforeDestroy!.lefts).toHaveLength(1);

    await leftRepo.destroy(left);

    const afterDestroy = await rightRepo.findOne({ id: r1.id });
    expect(afterDestroy).not.toBeNull();
    expect(afterDestroy!.lefts).toHaveLength(0);
  });
};
