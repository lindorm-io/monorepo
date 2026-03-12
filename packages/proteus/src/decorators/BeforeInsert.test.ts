import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { BeforeInsert } from "./BeforeInsert";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const beforeInsertCallback = jest.fn();

@Entity({ name: "BeforeInsertDecorated" })
@BeforeInsert(beforeInsertCallback)
class BeforeInsertDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeInsert", () => {
  test("should register BeforeInsert hook", () => {
    const meta = getEntityMetadata(BeforeInsertDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeInsert");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeInsertCallback);
  });
});
