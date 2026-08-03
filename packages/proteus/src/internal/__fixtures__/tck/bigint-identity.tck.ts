import { describe, test, expect, beforeEach } from "vitest";
import { isBigInt } from "@lindorm/is";
// TCK: BigInt Identity Suite
// A `@Generated("increment") @Field("bigint")` primary key is the shape real
// consumers use for high-volume tables. The driver mints the identity, and the
// value must be a JS bigint on every path it travels: the insert result, the
// criterion of a read, the PK serialisation of update/save/destroy, and the FK
// column of a referencing row. A driver that mints a number, or that stringifies
// a bigint PK, fails here.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";

// Far beyond any identity these tests mint, so it is guaranteed absent.
const ABSENT_ID = 424242424242n;

export const bigintIdentitySuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  caps: TckCapabilities,
) => {
  describe("BigInt Identity", () => {
    const { TckBigIntPkParent, TckBigIntPkChild, TckBigIntPkDeclaredChild } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    describe("auto-increment", () => {
      test("insert mints a JS bigint identity, not a number", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        // increment is DB-assigned — create() must NOT mint it.
        const built = repo.create({ name: "first" });
        expect(built.id).toBeNull();

        const inserted = await repo.insert(built);

        expect(isBigInt(inserted.id)).toBe(true);
        expect(inserted.name).toBe("first");
      });

      test("successive inserts receive strictly increasing bigint identities", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        const a = await repo.insert({ name: "a" });
        const b = await repo.insert({ name: "b" });
        const c = await repo.insert({ name: "c" });

        expect([isBigInt(a.id), isBigInt(b.id), isBigInt(c.id)]).toEqual([
          true,
          true,
          true,
        ]);
        expect(b.id > a.id).toBe(true);
        expect(c.id > b.id).toBe(true);
      });

      test("each entity keeps its own counter — a child insert does not advance the parent's", async () => {
        const parentRepo = getHandle().repository(TckBigIntPkParent);
        const childRepo = getHandle().repository(TckBigIntPkChild);

        const first = await parentRepo.insert({ name: "first" });

        // Two rows minted on the OTHER entity in between. Counters are
        // per-entity, so the parent's next identity is still its own +1.
        const child = await childRepo.insert({ label: "c1", parentId: first.id });
        await childRepo.insert({ label: "c2", parentId: first.id });

        const second = await parentRepo.insert({ name: "second" });

        expect(isBigInt(child.id)).toBe(true);
        expect(second.id - first.id).toBe(1n);
      });
    });

    describe("read paths", () => {
      test("findOne matches a row by its bigint identity and returns it as a bigint", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        const inserted = await repo.insert({ name: "findable" });
        const found = await repo.findOne({ id: inserted.id });

        expect(found).not.toBeNull();
        expect(isBigInt(found!.id)).toBe(true);
        expect(found!.id).toBe(inserted.id);
        expect(found!.name).toBe("findable");
      });

      test("findOne returns null for a bigint identity that does not exist", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        await repo.insert({ name: "only" });

        expect(await repo.findOne({ id: ABSENT_ID })).toBeNull();
      });

      // The FK column projected from the relation alone has no MetaField, so the
      // query layer cannot resolve it the way it resolves a declared field. It
      // must instead resolve it the way HYDRATION exposes it — under the camelCase
      // property key — otherwise the criterion a consumer writes is not the key
      // the entity they just read hands back. Under a renaming strategy
      // (postgres: snake) the property key and the physical column diverge, which
      // is where a column-name-only match breaks.
      test("find, count and order resolve an auto-projected FK by its property key", async () => {
        const parentRepo = getHandle().repository(TckBigIntPkParent);
        const childRepo = getHandle().repository(TckBigIntPkChild);

        const parent = await parentRepo.insert({ name: "parent" });
        const other = await parentRepo.insert({ name: "other" });

        await childRepo.insert({ label: "mine-1", parentId: parent.id });
        await childRepo.insert({ label: "mine-2", parentId: parent.id });
        await childRepo.insert({ label: "theirs", parentId: other.id });

        const children = await childRepo.find({ parentId: parent.id });

        expect(children.map((c) => c.label).sort()).toEqual(["mine-1", "mine-2"]);
        expect(children.every((c) => c.parentId === parent.id)).toBe(true);
        expect(await childRepo.count({ parentId: parent.id })).toBe(2);

        // `other` was inserted second, so it holds the higher identity.
        const ordered = await childRepo.find(undefined, {
          order: { parentId: "DESC", label: "ASC" },
        });
        expect(ordered.map((c) => c.label)).toEqual(["theirs", "mine-1", "mine-2"]);
      });

      test("select projects an auto-projected FK under its property key", async () => {
        const parentRepo = getHandle().repository(TckBigIntPkParent);
        const childRepo = getHandle().repository(TckBigIntPkChild);

        const parent = await parentRepo.insert({ name: "parent" });
        await childRepo.insert({ label: "only", parentId: parent.id });

        const [projected] = await childRepo.find(
          { parentId: parent.id },
          { select: ["label", "parentId"] },
        );

        expect(projected.label).toBe("only");
        expect(isBigInt(projected.parentId)).toBe(true);
        expect(projected.parentId).toBe(parent.id);
      });

      test("find and count filter on a bigint identity criterion", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        const a = await repo.insert({ name: "a" });
        await repo.insert({ name: "b" });

        const found = await repo.find({ id: a.id });

        expect(found).toHaveLength(1);
        expect(found[0].id).toBe(a.id);
        expect(await repo.count({ id: a.id })).toBe(1);
        expect(await repo.count({ id: ABSENT_ID })).toBe(0);
      });
    });

    describe("write operations (PK serialisation must be bigint-safe)", () => {
      test("update() persists a field change on a bigint-PK row", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        const inserted = await repo.insert({ name: "before" });
        inserted.name = "after";

        const updated = await repo.update(inserted);
        expect(updated.name).toBe("after");

        const found = await repo.findOne({ id: inserted.id });
        expect(found!.id).toBe(inserted.id);
        expect(found!.name).toBe("after");
      });

      test("save() on an existing bigint-PK row updates in place", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        const inserted = await repo.insert({ name: "orig" });
        inserted.name = "saved";

        const saved = await repo.save(inserted);
        expect(saved.id).toBe(inserted.id);
        expect(saved.name).toBe("saved");

        const all = await repo.find({ id: inserted.id });
        expect(all).toHaveLength(1);
        expect(all[0].name).toBe("saved");
      });

      test("destroy() removes a bigint-PK row and leaves its siblings", async () => {
        const repo = getHandle().repository(TckBigIntPkParent);

        const doomed = await repo.insert({ name: "gone" });
        const kept = await repo.insert({ name: "kept" });

        await repo.destroy(doomed);

        expect(await repo.findOne({ id: doomed.id })).toBeNull();
        expect(await repo.findOne({ id: kept.id })).not.toBeNull();
      });
    });

    // FK enforcement only means something where the driver actually enforces it.
    if (caps.referentialIntegrity) {
      describe("foreign-key integrity", () => {
        test("a declared bigint FK column round-trips as a bigint", async () => {
          const parentRepo = getHandle().repository(TckBigIntPkParent);
          const childRepo = getHandle().repository(TckBigIntPkDeclaredChild);

          const parent = await parentRepo.insert({ name: "parent" });
          const child = await childRepo.insert({ label: "child", parentId: parent.id });

          expect(isBigInt(child.parentId)).toBe(true);
          expect(child.parentId).toBe(parent.id);

          const found = await childRepo.findOne({ id: child.id });
          expect(isBigInt(found!.parentId)).toBe(true);
          expect(found!.parentId).toBe(parent.id);
        });

        test("children are found by the parent's bigint identity as a declared FK criterion", async () => {
          const parentRepo = getHandle().repository(TckBigIntPkParent);
          const childRepo = getHandle().repository(TckBigIntPkDeclaredChild);

          const parent = await parentRepo.insert({ name: "parent" });
          const other = await parentRepo.insert({ name: "other" });

          await childRepo.insert({ label: "mine-1", parentId: parent.id });
          await childRepo.insert({ label: "mine-2", parentId: parent.id });
          await childRepo.insert({ label: "theirs", parentId: other.id });

          const children = await childRepo.find({ parentId: parent.id });

          expect(children.map((c) => c.label).sort()).toEqual(["mine-1", "mine-2"]);
          expect(await childRepo.count({ parentId: parent.id })).toBe(2);
        });

        test("a child pointing at a non-existent bigint identity is rejected", async () => {
          const parentRepo = getHandle().repository(TckBigIntPkParent);
          const childRepo = getHandle().repository(TckBigIntPkDeclaredChild);

          await parentRepo.insert({ name: "parent" });

          await expect(
            childRepo.insert({ label: "orphan", parentId: ABSENT_ID }),
          ).rejects.toThrow(ProteusRepositoryError);
        });

        // The FK column projected from the relation alone (no @Field) must carry
        // the SAME bigint the declared column does — the DDL gives it the
        // referenced PK's bigint width, so the read path must hand it back at
        // that width too, not as whatever the driver's wire format happens to be.
        test("an auto-projected bigint FK column round-trips as a bigint", async () => {
          const parentRepo = getHandle().repository(TckBigIntPkParent);
          const childRepo = getHandle().repository(TckBigIntPkChild);

          const parent = await parentRepo.insert({ name: "parent" });
          const child = await childRepo.insert({ label: "child", parentId: parent.id });

          expect(isBigInt(child.parentId)).toBe(true);
          expect(child.parentId).toBe(parent.id);

          const found = await childRepo.findOne({ id: child.id });
          expect(isBigInt(found!.parentId)).toBe(true);
          expect(found!.parentId).toBe(parent.id);
        });

        test("a child on an auto-projected bigint FK pointing at nothing is rejected", async () => {
          const parentRepo = getHandle().repository(TckBigIntPkParent);
          const childRepo = getHandle().repository(TckBigIntPkChild);

          await parentRepo.insert({ name: "parent" });

          await expect(
            childRepo.insert({ label: "orphan", parentId: ABSENT_ID }),
          ).rejects.toThrow(ProteusRepositoryError);
        });
      });
    }
  });
};
