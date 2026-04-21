import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { AfterUpdate } from "./AfterUpdate.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const afterUpdateCallback = vi.fn();

@Entity({ name: "AfterUpdateDecorated" })
@AfterUpdate(afterUpdateCallback)
class AfterUpdateDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterUpdate", () => {
  test("should register AfterUpdate hook", () => {
    const meta = getEntityMetadata(AfterUpdateDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterUpdate");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterUpdateCallback);
  });
});
