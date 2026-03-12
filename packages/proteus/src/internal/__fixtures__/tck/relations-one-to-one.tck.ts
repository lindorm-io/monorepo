// TCK: Relations OneToOne Suite
// Tests OneToOne relation: owning side (TckOwner) and inverse side (TckDetail).

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const relationsOneToOneSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckOwner, TckDetail } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("insert owner with detail saves both and sets FK", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const detail = await detailRepo.insert({ info: "detail-info" });
    const owner = await ownerRepo.insert({ name: "Owner1", detail, detailId: detail.id });

    expect(owner.detailId).toBe(detail.id);

    const found = await ownerRepo.findOne({ id: owner.id });
    expect(found).not.toBeNull();
    expect(found!.detail).not.toBeNull();
    expect(found!.detail!.id).toBe(detail.id);
    expect(found!.detail!.info).toBe("detail-info");
  });

  test("find owner eager-loads detail", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const detail = await detailRepo.insert({ info: "eager-info" });
    await ownerRepo.insert({ name: "Owner2", detail, detailId: detail.id });

    const owners = await ownerRepo.find();
    expect(owners).toHaveLength(1);
    expect(owners[0].detail).not.toBeNull();
    expect(owners[0].detail!.info).toBe("eager-info");
  });

  test("find detail eager-loads owner (inverse side)", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const detail = await detailRepo.insert({ info: "inverse-info" });
    await ownerRepo.insert({ name: "Owner3", detail, detailId: detail.id });

    const details = await detailRepo.find();
    expect(details).toHaveLength(1);
    expect(details[0].owner).not.toBeNull();
    expect(details[0].owner!.name).toBe("Owner3");
  });

  test("owner without detail has null relation", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const owner = await ownerRepo.insert({ name: "Lonely" });

    const found = await ownerRepo.findOne({ id: owner.id });
    expect(found).not.toBeNull();
    expect(found!.detail).toBeNull();
    expect(found!.detailId).toBeNull();
  });

  test("cascade save on owner creates detail", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const detail = detailRepo.create({ info: "cascade-detail" });
    const saved = await ownerRepo.save({ name: "CascadeOwner", detail });

    // After save, verify via find (RETURNING doesn't include relation objects)
    const found = await ownerRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.detail).not.toBeNull();
    expect(found!.detailId).toBeDefined();
    expect(found!.detail!.info).toBe("cascade-detail");

    const savedDetail = await detailRepo.findOne({ id: found!.detailId! });
    expect(savedDetail).not.toBeNull();
    expect(savedDetail!.info).toBe("cascade-detail");
  });

  test("unlink relation by setting FK to null", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const detail = await detailRepo.insert({ info: "unlink-detail" });
    const owner = await ownerRepo.insert({
      name: "UnlinkOwner",
      detail,
      detailId: detail.id,
    });

    // Reload full entity then update: clear the relation and FK
    const ownerToUpdate = await ownerRepo.findOneOrFail({ id: owner.id });
    await ownerRepo.update({ ...ownerToUpdate, detailId: null, detail: null });

    // Owner should have no detail after reload
    const reloadedOwner = await ownerRepo.findOne({ id: owner.id });
    expect(reloadedOwner).not.toBeNull();
    expect(reloadedOwner!.detail).toBeNull();
    expect(reloadedOwner!.detailId).toBeNull();

    // Detail itself must still exist in DB
    const detailStillExists = await detailRepo.findOne({ id: detail.id });
    expect(detailStillExists).not.toBeNull();
    expect(detailStillExists!.info).toBe("unlink-detail");
  });

  test("replace relation with new detail", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const detailA = await detailRepo.insert({ info: "detail-A" });
    const owner = await ownerRepo.insert({
      name: "ReplaceOwner",
      detail: detailA,
      detailId: detailA.id,
    });

    const detailB = await detailRepo.insert({ info: "detail-B" });

    // Reload full entity then update to point to detail B
    const ownerToUpdate = await ownerRepo.findOneOrFail({ id: owner.id });
    await ownerRepo.update({ ...ownerToUpdate, detail: detailB, detailId: detailB.id });

    // Owner should now reference detail B
    const reloadedOwner = await ownerRepo.findOne({ id: owner.id });
    expect(reloadedOwner).not.toBeNull();
    expect(reloadedOwner!.detailId).toBe(detailB.id);
    expect(reloadedOwner!.detail).not.toBeNull();
    expect(reloadedOwner!.detail!.id).toBe(detailB.id);
    expect(reloadedOwner!.detail!.info).toBe("detail-B");
  });

  // ─── Batch loading: inverse side — multiple detail/owner pairs ────────────
  test("find() on detail loads correct owner for each of multiple detail rows", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const d1 = await detailRepo.insert({ info: "batch-detail-1" });
    const d2 = await detailRepo.insert({ info: "batch-detail-2" });

    const o1 = await ownerRepo.insert({
      name: "BatchOwner1",
      detail: d1,
      detailId: d1.id,
    });
    const o2 = await ownerRepo.insert({
      name: "BatchOwner2",
      detail: d2,
      detailId: d2.id,
    });

    const allDetails = await detailRepo.find(undefined, { order: { info: "ASC" } });
    expect(allDetails).toHaveLength(2);

    const detail1 = allDetails.find((d) => d.info === "batch-detail-1")!;
    const detail2 = allDetails.find((d) => d.info === "batch-detail-2")!;

    expect(detail1.owner).not.toBeNull();
    expect(detail1.owner!.id).toBe(o1.id);
    expect(detail1.owner!.name).toBe("BatchOwner1");

    expect(detail2.owner).not.toBeNull();
    expect(detail2.owner!.id).toBe(o2.id);
    expect(detail2.owner!.name).toBe("BatchOwner2");
  });

  // ─── Batch loading: owning side — multiple owner/detail pairs ────────────
  test("find() on owner loads correct detail for each of multiple owner rows", async () => {
    const ownerRepo = getHandle().repository(TckOwner);
    const detailRepo = getHandle().repository(TckDetail);

    const d1 = await detailRepo.insert({ info: "own-batch-1" });
    const d2 = await detailRepo.insert({ info: "own-batch-2" });

    await ownerRepo.insert({ name: "OwnBatchA", detail: d1, detailId: d1.id });
    await ownerRepo.insert({ name: "OwnBatchB", detail: d2, detailId: d2.id });

    const allOwners = await ownerRepo.find(undefined, { order: { name: "ASC" } });
    expect(allOwners).toHaveLength(2);

    const ownerA = allOwners.find((o) => o.name === "OwnBatchA")!;
    const ownerB = allOwners.find((o) => o.name === "OwnBatchB")!;

    expect(ownerA.detail).not.toBeNull();
    expect(ownerA.detail!.info).toBe("own-batch-1");

    expect(ownerB.detail).not.toBeNull();
    expect(ownerB.detail!.info).toBe("own-batch-2");
  });
};
