import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { AfterRestore } from "./AfterRestore.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const afterRestoreCallback = vi.fn();

@Entity({ name: "AfterRestoreDecorated" })
@AfterRestore(afterRestoreCallback)
class AfterRestoreDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = vi.fn();
const multiHookCb2 = vi.fn();

@Entity({ name: "AfterRestoreMultiHook" })
@AfterRestore(multiHookCb1)
@AfterRestore(multiHookCb2)
class AfterRestoreMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterRestore", () => {
  test("should register AfterRestore hook", () => {
    const meta = getEntityMetadata(AfterRestoreDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterRestore");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterRestoreCallback);
  });

  test("should register multiple AfterRestore hooks on same entity", () => {
    const meta = getEntityMetadata(AfterRestoreMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterRestore");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
