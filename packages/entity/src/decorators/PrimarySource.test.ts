import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { PrimarySource } from "./PrimarySource";

describe("PrimarySource Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @PrimarySource("MongoSource")
    class PrimarySourceDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(PrimarySourceDecoratorEntity)).toMatchSnapshot();
  });
});
