import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { BeforeSave } from "./BeforeSave.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const beforeSaveCallback = vi.fn();

@Entity({ name: "BeforeSaveDecorated" })
@BeforeSave(beforeSaveCallback)
class BeforeSaveDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeSave", () => {
  test("should register BeforeSave hook", () => {
    const meta = getEntityMetadata(BeforeSaveDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeSave");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeSaveCallback);
  });
});
