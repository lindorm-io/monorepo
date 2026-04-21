import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { AfterDestroy } from "./AfterDestroy.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const afterDestroyCallback = vi.fn();

@Entity({ name: "AfterDestroyDecorated" })
@AfterDestroy(afterDestroyCallback)
class AfterDestroyDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterDestroy", () => {
  test("should register AfterDestroy hook", () => {
    const meta = getEntityMetadata(AfterDestroyDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterDestroy");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterDestroyCallback);
  });
});
