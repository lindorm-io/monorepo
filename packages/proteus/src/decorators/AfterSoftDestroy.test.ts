import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { AfterSoftDestroy } from "./AfterSoftDestroy.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const afterSoftDestroyCallback = vi.fn();

@Entity({ name: "AfterSoftDestroyDecorated" })
@AfterSoftDestroy(afterSoftDestroyCallback)
class AfterSoftDestroyDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = vi.fn();
const multiHookCb2 = vi.fn();

@Entity({ name: "AfterSoftDestroyMultiHook" })
@AfterSoftDestroy(multiHookCb1)
@AfterSoftDestroy(multiHookCb2)
class AfterSoftDestroyMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterSoftDestroy", () => {
  test("should register AfterSoftDestroy hook", () => {
    const meta = getEntityMetadata(AfterSoftDestroyDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterSoftDestroy");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterSoftDestroyCallback);
  });

  test("should register multiple AfterSoftDestroy hooks on same entity", () => {
    const meta = getEntityMetadata(AfterSoftDestroyMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterSoftDestroy");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
