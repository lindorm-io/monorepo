import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("Entity Decorator", () => {
  test("should add metadata", () => {
    @Entity({
      database: "database",
      name: "name",
      namespace: "namespace",
    })
    class EntityDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(EntityDecoratorEntity)).toMatchSnapshot();
  });
});
