import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { OnDestroy } from "./OnDestroy";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("OnDestroy Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @OnDestroy(() => {})
    class OnDestroyDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(OnDestroyDecoratorEntity)).toMatchSnapshot();
  });
});
