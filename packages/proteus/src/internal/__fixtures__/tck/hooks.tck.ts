// TCK: Hooks Suite
// Tests hook invocation (not ordering). Uses jest.fn() for verification.
// Intent-based hooks: insert→BeforeInsert/AfterInsert, update→BeforeUpdate/AfterUpdate,
// save→BeforeSave/AfterSave (not Insert/Update hooks).

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const hooksSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  hookCallback: jest.Mock,
) => {
  describe("Hooks", () => {
    const { TckHooked } = entities;

    beforeEach(async () => {
      await getHandle().clear();
      hookCallback.mockClear();
    });

    test("insert fires OnCreate, OnValidate, BeforeInsert, AfterInsert", async () => {
      const repo = getHandle().repository(TckHooked);
      await repo.insert({ name: "HookInsert" });

      const calls = hookCallback.mock.calls.length;
      // OnCreate + OnValidate + BeforeInsert + AfterInsert = 4 minimum
      expect(calls).toBeGreaterThanOrEqual(4);
    });

    test("update fires OnValidate, BeforeUpdate, AfterUpdate", async () => {
      const repo = getHandle().repository(TckHooked);
      const entity = await repo.insert({ name: "HookUpdate" });
      hookCallback.mockClear();

      entity.name = "HookUpdated";
      await repo.update(entity);

      const calls = hookCallback.mock.calls.length;
      // OnCreate (copy) + OnValidate + BeforeUpdate + AfterUpdate = 4 minimum
      expect(calls).toBeGreaterThanOrEqual(3);
    });

    // Intent-based hooks: save() fires BeforeSave/AfterSave, NOT BeforeInsert/AfterInsert.
    // Count breakdown (insert path): OnCreate(create) + OnCreate(copy in insert) +
    //   OnValidate + BeforeSave + AfterSave = 5.
    // If save incorrectly also fired insert hooks, count would be 7.
    test("save fires BeforeSave/AfterSave, not BeforeInsert/AfterInsert", async () => {
      const repo = getHandle().repository(TckHooked);

      await repo.save({ name: "HookSave" });

      const calls = hookCallback.mock.calls.length;
      expect(calls).toBe(5);
    });

    // Intent-based hooks: save(existing) fires BeforeSave/AfterSave, NOT BeforeUpdate/AfterUpdate.
    // Count breakdown (update path): OnCreate(copy in update) +
    //   OnValidate + BeforeSave + AfterSave = 4.
    // (No extra OnCreate from saveOne — hydrated entities are proper class instances.)
    // If save incorrectly also fired update hooks, count would be 6.
    test("save (update path) fires BeforeSave/AfterSave, not BeforeUpdate/AfterUpdate", async () => {
      const repo = getHandle().repository(TckHooked);
      const entity = await repo.insert({ name: "HookSaveUpdate" });
      hookCallback.mockClear();

      entity.name = "HookSaveUpdated";
      await repo.save(entity);

      const calls = hookCallback.mock.calls.length;
      expect(calls).toBe(4);
    });

    test("destroy fires BeforeDestroy, AfterDestroy", async () => {
      const repo = getHandle().repository(TckHooked);
      const entity = await repo.insert({ name: "HookDestroy" });
      hookCallback.mockClear();

      await repo.destroy(entity);

      const calls = hookCallback.mock.calls.length;
      // BeforeDestroy + AfterDestroy = 2 minimum
      expect(calls).toBeGreaterThanOrEqual(2);
    });

    test("find fires AfterLoad for each loaded entity", async () => {
      const repo = getHandle().repository(TckHooked);
      await repo.insert({ name: "Load1" });
      await repo.insert({ name: "Load2" });
      hookCallback.mockClear();

      await repo.find();

      // AfterLoad should fire for each entity
      expect(hookCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test("hooks receive context and entity as arguments", async () => {
      const repo = getHandle().repository(TckHooked);
      await repo.insert({ name: "HookArg" });

      // Hooks now receive (context, entity) — entity is at index 1
      const hasEntityArg = hookCallback.mock.calls.some(
        (call: any[]) => call[1] && call[1].name === "HookArg",
      );
      expect(hasEntityArg).toBe(true);
    });

    test("create (sync) fires OnCreate hook", async () => {
      const repo = getHandle().repository(TckHooked);
      hookCallback.mockClear();

      repo.create({ name: "SyncCreate" });

      expect(hookCallback).toHaveBeenCalled();
    });

    test("clone fires BeforeInsert, AfterInsert", async () => {
      const repo = getHandle().repository(TckHooked);
      const entity = await repo.insert({ name: "HookClone" });
      hookCallback.mockClear();

      await repo.clone(entity);

      const calls = hookCallback.mock.calls.length;
      // OnCreate (clone) + OnValidate + BeforeInsert + AfterInsert = 4 minimum
      expect(calls).toBeGreaterThanOrEqual(4);
    });

    test("validate (sync) fires OnValidate hook", async () => {
      const repo = getHandle().repository(TckHooked);
      // Use an inserted entity so generated fields (id, dates) are populated
      const entity = await repo.insert({ name: "ValidateHook" });
      hookCallback.mockClear();

      repo.validate(entity);

      expect(hookCallback).toHaveBeenCalled();
    });

    // A6: A hook throwing must abort the operation and leave no persisted entity.
    test("hook error aborts insert", async () => {
      const repo = getHandle().repository(TckHooked);

      hookCallback.mockImplementationOnce(() => {
        throw new Error("Hook failed");
      });

      await expect(repo.insert({ name: "HookAbort" })).rejects.toThrow();

      const count = await repo.count();
      expect(count).toBe(0);
    });
  });
};
