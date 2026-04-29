import { storeSnapshot, getSnapshot, clearSnapshot } from "./snapshot-store.js";
import { describe, expect, test } from "vitest";

describe("snapshot-store", () => {
  test("should store and retrieve a snapshot", () => {
    const entity = { id: "1" };
    const dict = { id: "1", name: "Alice" };

    storeSnapshot(entity, dict);

    expect(getSnapshot(entity)).toBe(dict);
  });

  test("should return null for entity without snapshot", () => {
    const entity = { id: "2" };
    expect(getSnapshot(entity)).toBeNull();
  });

  test("should overwrite existing snapshot", () => {
    const entity = { id: "3" };
    const dict1 = { id: "3", name: "Alice" };
    const dict2 = { id: "3", name: "Bob" };

    storeSnapshot(entity, dict1);
    storeSnapshot(entity, dict2);

    expect(getSnapshot(entity)).toBe(dict2);
  });

  test("should clear snapshot", () => {
    const entity = { id: "4" };
    storeSnapshot(entity, { id: "4" });

    clearSnapshot(entity);

    expect(getSnapshot(entity)).toBeNull();
  });

  test("should clear be idempotent on entity without snapshot", () => {
    const entity = { id: "5" };
    expect(() => clearSnapshot(entity)).not.toThrow();
  });

  test("should isolate snapshots per entity reference", () => {
    const a = { id: "A" };
    const b = { id: "B" };

    storeSnapshot(a, { val: 1 });
    storeSnapshot(b, { val: 2 });

    expect(getSnapshot(a)).toEqual({ val: 1 });
    expect(getSnapshot(b)).toEqual({ val: 2 });
  });
});
