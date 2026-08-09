import { describe, test, expect, beforeEach } from "vitest";
// TCK: Foreign Key Storage Suite
//
// What a driver STORES for an owning relation's foreign key, and what it hands
// back for it. Deliberately separate from `foreignKeysSuite`: that one is about
// DB-level constraint ENFORCEMENT and is gated on `referentialIntegrity`, which
// redis and mongo do not carry. Whether writing a child through a relation
// OBJECT persists its FK is not an enforcement question — every driver owes the
// same answer, and gating it is what hid a redis write that stored null.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const foreignKeyStorageSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Foreign Key Storage", () => {
    const { TckFkParent, TckFkCascadeChild, TckFkNullifyChild, TckFkAutoNullableChild } =
      entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert child with valid parent FK succeeds", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkCascadeChild);

      const parent = await parentRepo.insert({ name: "Parent" });
      const child = await childRepo.insert({ value: "child-1", parentId: parent.id });

      expect(child.id).toBeDefined();
      expect(child.parentId).toBe(parent.id);

      const reloaded = await childRepo.findOne({ id: child.id });
      expect(reloaded?.parentId).toBe(parent.id);
    });

    // Setting the *ToOne relation object (without the FK column) must derive and
    // persist the owning-side FK. Previously the FK was written NULL, violating
    // the NOT NULL constraint on a required relation.
    test("insert child deriving FK from the relation object succeeds", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkCascadeChild);

      const parent = await parentRepo.insert({ name: "RelObjParent" });
      const child = await childRepo.insert({ value: "rel-child", parent });

      expect(child.parentId).toBe(parent.id);

      const reloaded = await childRepo.findOne({ id: child.id });
      expect(reloaded?.parentId).toBe(parent.id);
    });

    test("insert child with null FK on nullable relation succeeds", async () => {
      const childRepo = getHandle().repository(TckFkNullifyChild);

      const child = await childRepo.insert({ value: "no-parent", parentId: null });

      expect(child.id).toBeDefined();
      expect(child.parentId).toBeNull();
    });

    // Nullable AUTO-FK (distinct from TckFkNullifyChild's explicit @Nullable @Field FK):
    // @Nullable sits on the OWNING relation, so the auto-generated FK column must be
    // created NULLABLE in the real DDL. If it weren't, postgres/mysql would reject an
    // insert that omits the relation with a NOT NULL violation.
    test("insert child WITHOUT the nullable auto-FK relation succeeds and round-trips null", async () => {
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      // No `parent` relation set at all — the auto-FK column must accept NULL.
      const child = await childRepo.insert({ value: "auto-no-parent" });

      expect(child.id).toBeDefined();
      expect(child.parentId).toBeNull();

      const reloaded = await childRepo.findOne({ id: child.id });
      expect(reloaded).not.toBeNull();
      expect(reloaded?.parentId).toBeNull();
      expect(reloaded?.parent ?? null).toBeNull();
    });

    // The auto-FK has no @Field of its own, so the only property naming it is a
    // @RelationId — and a driver that treats that virtual property as "already
    // handled" drops the FK from the written row and silently orphans the child.
    test("insert child WITH the nullable auto-FK relation populates and round-trips the auto-FK", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "AutoNullableParent" });
      // Set the relation OBJECT (no explicit FK column exists) → FK derived from relation.
      const child = await childRepo.insert({ value: "auto-with-parent", parent });

      expect(child.parentId).toBe(parent.id);

      const reloaded = await childRepo.findOne({ id: child.id });
      expect(reloaded?.parentId).toBe(parent.id);
    });

    // The naming divergence that breaks an auto-projected FK criterion has nothing
    // to do with the column's type — a uuid FK fails exactly like a bigint one. The
    // criterion key must be the property key hydration hands back, not the physical
    // column (`parent_id` under snake).
    test("find and delete resolve an auto-projected uuid FK by its property key", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkCascadeChild);

      const parent = await parentRepo.insert({ name: "CriterionParent" });
      const other = await parentRepo.insert({ name: "OtherParent" });

      await childRepo.insert({ value: "mine-1", parentId: parent.id });
      await childRepo.insert({ value: "mine-2", parentId: parent.id });
      await childRepo.insert({ value: "theirs", parentId: other.id });

      const mine = await childRepo.find({ parentId: parent.id });
      expect(mine.map((c) => c.value).sort()).toEqual(["mine-1", "mine-2"]);
      expect(await childRepo.count({ parentId: parent.id })).toBe(2);

      await childRepo.delete({ parentId: parent.id });

      const remaining = await childRepo.find();
      expect(remaining.map((c) => c.value)).toEqual(["theirs"]);
    });
  });
};
