import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { OnUpdate } from "./OnUpdate";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("OnUpdate Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @OnUpdate(() => {})
    class OnUpdateDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(OnUpdateDecoratorEntity)).toMatchSnapshot();
  });
});
