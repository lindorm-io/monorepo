import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { BeforeDestroy } from "./BeforeDestroy";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const beforeDestroyCallback = jest.fn();

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
