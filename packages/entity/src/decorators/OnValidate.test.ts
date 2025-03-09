import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { OnValidate } from "./OnValidate";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("OnValidate Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @OnValidate(() => {})
    class OnValidateDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(OnValidateDecoratorEntity)).toMatchSnapshot();
  });
});
