import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { AfterInsert } from "./AfterInsert";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const afterInsertCallback = jest.fn();

@Entity({ name: "AfterInsertDecorated" })
@AfterInsert(afterInsertCallback)
class AfterInsertDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = jest.fn();
const multiHookCb2 = jest.fn();

@Entity({ name: "AfterInsertMultiHook" })
@AfterInsert(multiHookCb1)
@AfterInsert(multiHookCb2)
class AfterInsertMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterInsert", () => {
  test("should register AfterInsert hook", () => {
    const meta = getEntityMetadata(AfterInsertDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterInsert");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterInsertCallback);
  });

  test("should register multiple AfterInsert hooks on same entity", () => {
    const meta = getEntityMetadata(AfterInsertMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterInsert");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
