import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { AfterLoad } from "./AfterLoad";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const afterLoadCallback = jest.fn();

@Entity({ name: "AfterLoadDecorated" })
@AfterLoad(afterLoadCallback)
class AfterLoadDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterLoad", () => {
  test("should register AfterLoad hook", () => {
    const meta = getEntityMetadata(AfterLoadDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterLoad");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterLoadCallback);
  });
});
