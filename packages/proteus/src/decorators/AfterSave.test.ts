import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { AfterSave } from "./AfterSave";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const afterSaveCallback = jest.fn();

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
