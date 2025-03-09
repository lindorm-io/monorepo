import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { OnCreate } from "./OnCreate";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("OnCreate Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @OnCreate(() => {})
    class OnCreateDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(OnCreateDecoratorEntity)).toMatchSnapshot();
  });
});
