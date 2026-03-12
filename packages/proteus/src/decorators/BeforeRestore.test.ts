import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { BeforeRestore } from "./BeforeRestore";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";

const beforeRestoreCallback = jest.fn();

@Entity({ name: "BeforeRestoreDecorated" })
@BeforeRestore(beforeRestoreCallback)
class BeforeRestoreDecorated {
  @PrimaryKeyField()
  id!: string;
}

const multiHookCb1 = jest.fn();
const multiHookCb2 = jest.fn();

@Entity({ name: "BeforeRestoreMultiHook" })
@BeforeRestore(multiHookCb1)
@BeforeRestore(multiHookCb2)
class BeforeRestoreMultiHook {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeRestore", () => {
  test("should register BeforeRestore hook", () => {
    const meta = getEntityMetadata(BeforeRestoreDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeRestore");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeRestoreCallback);
  });

  test("should register multiple BeforeRestore hooks on same entity", () => {
    const meta = getEntityMetadata(BeforeRestoreMultiHook);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeRestore");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb1);
    expect(hooks.map((h) => h.callback)).toContain(multiHookCb2);
  });
});
