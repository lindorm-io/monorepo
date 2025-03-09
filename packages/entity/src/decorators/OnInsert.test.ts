import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { OnInsert } from "./OnInsert";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("OnInsert Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @OnInsert(() => {})
    class OnInsertDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(OnInsertDecoratorEntity)).toMatchSnapshot();
  });
});
