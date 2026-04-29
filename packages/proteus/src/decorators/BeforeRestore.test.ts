import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { BeforeRestore } from "./BeforeRestore.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const beforeRestoreCallback = vi.fn();

@Entity({ name: "BeforeRestoreDecorated" })
@BeforeRestore(beforeRestoreCallback)
class BeforeRestoreDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = vi.fn();
const multiHookCb2 = vi.fn();

@Entity({ name: "BeforeRestoreMultiHook" })
@BeforeRestore(multiHookCb1)
@BeforeRestore(multiHookCb2)
class BeforeRestoreMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeRestore", () => {
  test("should register BeforeRestore hook", () => {
    const meta = getEntityMetadata(BeforeRestoreDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeRestore");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeRestoreCallback);
  });

  test("should register multiple BeforeRestore hooks on same entity", () => {
    const meta = getEntityMetadata(BeforeRestoreMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeRestore");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
