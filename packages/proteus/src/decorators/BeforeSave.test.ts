import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { BeforeSave } from "./BeforeSave";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const beforeSaveCallback = jest.fn();

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
