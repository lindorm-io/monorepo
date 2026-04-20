import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { BeforeUpdate } from "./BeforeUpdate";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test, vi } from "vitest";

const beforeUpdateCallback = vi.fn();

@Entity({ name: "BeforeUpdateDecorated" })
@BeforeUpdate(beforeUpdateCallback)
class BeforeUpdateDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeUpdate", () => {
  test("should register BeforeUpdate hook", () => {
    const meta = getEntityMetadata(BeforeUpdateDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeUpdate");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeUpdateCallback);
  });
});
