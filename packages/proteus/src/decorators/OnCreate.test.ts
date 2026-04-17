import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { OnCreate } from "./OnCreate";
import { PrimaryKeyField } from "./PrimaryKeyField";

const onCreateCallback = jest.fn();

@Entity({ name: "OnCreateDecorated" })
@OnCreate(onCreateCallback)
class OnCreateDecorated {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "OnCreateMultiple" })
@OnCreate(onCreateCallback)
@OnCreate(onCreateCallback)
class OnCreateMultiple {
  @PrimaryKeyField()
  id!: string;
}

describe("OnCreate", () => {
  test("should register OnCreate hook", () => {
    const meta = getEntityMetadata(OnCreateDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "OnCreate");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(onCreateCallback);
  });

  test("should register multiple OnCreate hooks", () => {
    const meta = getEntityMetadata(OnCreateMultiple);
    const hooks = meta.hooks.filter((h) => h.decorator === "OnCreate");
    expect(hooks).toHaveLength(2);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(OnCreateDecorated)).toMatchSnapshot();
  });
});
