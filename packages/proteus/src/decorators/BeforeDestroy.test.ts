import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { BeforeDestroy } from "./BeforeDestroy.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const beforeDestroyCallback = vi.fn();

@Entity({ name: "BeforeDestroyDecorated" })
@BeforeDestroy(beforeDestroyCallback)
class BeforeDestroyDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeDestroy", () => {
  test("should register BeforeDestroy hook", () => {
    const meta = getEntityMetadata(BeforeDestroyDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeDestroy");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeDestroyCallback);
  });
});
