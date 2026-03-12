import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { AfterSoftDestroy } from "./AfterSoftDestroy";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const afterSoftDestroyCallback = jest.fn();

@Entity({ name: "AfterSoftDestroyDecorated" })
@AfterSoftDestroy(afterSoftDestroyCallback)
class AfterSoftDestroyDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = jest.fn();
const multiHookCb2 = jest.fn();

@Entity({ name: "AfterSoftDestroyMultiHook" })
@AfterSoftDestroy(multiHookCb1)
@AfterSoftDestroy(multiHookCb2)
class AfterSoftDestroyMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterSoftDestroy", () => {
  test("should register AfterSoftDestroy hook", () => {
    const meta = getEntityMetadata(AfterSoftDestroyDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterSoftDestroy");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterSoftDestroyCallback);
  });

  test("should register multiple AfterSoftDestroy hooks on same entity", () => {
    const meta = getEntityMetadata(AfterSoftDestroyMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterSoftDestroy");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
