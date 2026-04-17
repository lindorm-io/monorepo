import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { BeforeSoftDestroy } from "./BeforeSoftDestroy";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const beforeSoftDestroyCallback = jest.fn();

@Entity({ name: "BeforeSoftDestroyDecorated" })
@BeforeSoftDestroy(beforeSoftDestroyCallback)
class BeforeSoftDestroyDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = jest.fn();
const multiHookCb2 = jest.fn();

@Entity({ name: "BeforeSoftDestroyMultiHook" })
@BeforeSoftDestroy(multiHookCb1)
@BeforeSoftDestroy(multiHookCb2)
class BeforeSoftDestroyMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeSoftDestroy", () => {
  test("should register BeforeSoftDestroy hook", () => {
    const meta = getEntityMetadata(BeforeSoftDestroyDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeSoftDestroy");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeSoftDestroyCallback);
  });

  test("should register multiple BeforeSoftDestroy hooks on same entity", () => {
    const meta = getEntityMetadata(BeforeSoftDestroyMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeSoftDestroy");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
