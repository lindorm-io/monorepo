import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { ScopeColumn } from "./ScopeColumn";

describe("ScopeColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class ScopeColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @ScopeColumn()
      scope!: string;
    }

    expect(globalEntityMetadata.get(ScopeColumnDecoratorEntity)).toMatchSnapshot();
  });
});
