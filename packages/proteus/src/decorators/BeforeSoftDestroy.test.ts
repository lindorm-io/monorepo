import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { BeforeSoftDestroy } from "./BeforeSoftDestroy.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const beforeSoftDestroyCallback = vi.fn();

@Entity({ name: "BeforeSoftDestroyDecorated" })
@BeforeSoftDestroy(beforeSoftDestroyCallback)
class BeforeSoftDestroyDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = vi.fn();
const multiHookCb2 = vi.fn();

@Entity({ name: "BeforeSoftDestroyMultiHook" })
@BeforeSoftDestroy(multiHookCb1)
@BeforeSoftDestroy(multiHookCb2)
class BeforeSoftDestroyMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeSoftDestroy", () => {
  test("should register BeforeSoftDestroy hook", () => {
    const meta = getEntityMetadata(BeforeSoftDestroyDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeSoftDestroy");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeSoftDestroyCallback);
  });

  test("should register multiple BeforeSoftDestroy hooks on same entity", () => {
    const meta = getEntityMetadata(BeforeSoftDestroyMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeSoftDestroy");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
