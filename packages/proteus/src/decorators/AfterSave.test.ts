import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { AfterSave } from "./AfterSave.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const afterSaveCallback = vi.fn();

@Entity({ name: "AfterSaveDecorated" })
@AfterSave(afterSaveCallback)
class AfterSaveDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterSave", () => {
  test("should register AfterSave hook", () => {
    const meta = getEntityMetadata(AfterSaveDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterSave");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterSaveCallback);
  });
});
