import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { AfterUpdate } from "./AfterUpdate";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const afterUpdateCallback = jest.fn();

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
