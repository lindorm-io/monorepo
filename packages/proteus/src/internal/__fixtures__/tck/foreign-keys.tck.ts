import { describe, test, expect, beforeEach } from "vitest";
// TCK: Foreign Keys Suite
// Tests DB-level FK constraint enforcement: insert validation,
// ON DELETE CASCADE, ON DELETE RESTRICT, ON DELETE SET NULL.
// Uses delete(criteria) to bypass app-level cascade and test pure DB constraints.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError";

export const foreignKeysSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Foreign Keys", () => {
    const { TckFkParent, TckFkCascadeChild, TckFkRestrictChild, TckFkNullifyChild } =
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
    });

    test("insert child with non-existent parent FK rejects", async () => {
      const childRepo = getHandle().repository(TckFkCascadeChild);

      await expect(
        childRepo.insert({
          value: "orphan",
          parentId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(ProteusRepositoryError);
    });

    test("insert child with null FK on nullable relation succeeds", async () => {
      const childRepo = getHandle().repository(TckFkNullifyChild);

      const child = await childRepo.insert({ value: "no-parent", parentId: null });

      expect(child.id).toBeDefined();
      expect(child.parentId).toBeNull();
    });

    test("delete(criteria) parent with ON DELETE CASCADE removes children", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkCascadeChild);

      const parent = await parentRepo.insert({ name: "CascadeParent" });
      await childRepo.insert({ value: "c1", parentId: parent.id });
      await childRepo.insert({ value: "c2", parentId: parent.id });

      // Raw delete bypasses app-level cascade — triggers DB-level ON DELETE CASCADE
      await parentRepo.delete({ id: parent.id });

      const remaining = await childRepo.find();
      expect(remaining).toHaveLength(0);
    });

    test("delete(criteria) parent with ON DELETE RESTRICT throws when children exist", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkRestrictChild);

      const parent = await parentRepo.insert({ name: "RestrictParent" });
      await childRepo.insert({ value: "r1", parentId: parent.id });

      await expect(parentRepo.delete({ id: parent.id })).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("delete(criteria) parent with ON DELETE SET NULL nullifies children FK", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkNullifyChild);

      const parent = await parentRepo.insert({ name: "NullifyParent" });
      await childRepo.insert({ value: "n1", parentId: parent.id });
      await childRepo.insert({ value: "n2", parentId: parent.id });

      await parentRepo.delete({ id: parent.id });

      const children = await childRepo.find();
      expect(children).toHaveLength(2);
      for (const child of children) {
        expect(child.parentId).toBeNull();
      }
    });

    test("delete(criteria) parent with no children succeeds for any constraint", async () => {
      const parentRepo = getHandle().repository(TckFkParent);

      const parent = await parentRepo.insert({ name: "Lonely" });

      // Should not throw even with RESTRICT children — because there are none
      await parentRepo.delete({ id: parent.id });

      const found = await parentRepo.findOne({ id: parent.id });
      expect(found).toBeNull();
    });

    test("re-insert child after parent delete with cascade succeeds", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkCascadeChild);

      const parent1 = await parentRepo.insert({ name: "P1" });
      await childRepo.insert({ value: "c1", parentId: parent1.id });

      // Delete parent — cascades to child
      await parentRepo.delete({ id: parent1.id });

      // Insert new parent and child — should work fine
      const parent2 = await parentRepo.insert({ name: "P2" });
      const newChild = await childRepo.insert({ value: "c2", parentId: parent2.id });

      expect(newChild.parentId).toBe(parent2.id);
    });

    test("update child FK to non-existent parent rejects", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkCascadeChild);

      const parent = await parentRepo.insert({ name: "RealParent" });
      const child = await childRepo.insert({
        value: "child-update",
        parentId: parent.id,
      });

      await expect(
        childRepo.updateMany(
          { id: child.id },
          { parentId: "00000000-0000-0000-0000-000000000000" },
        ),
      ).rejects.toThrow(ProteusRepositoryError);
    });
  });
};
