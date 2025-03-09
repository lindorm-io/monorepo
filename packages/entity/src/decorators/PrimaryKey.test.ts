import { globalEntityMetadata } from "../utils";
import { Column } from "./Column";
import { Entity } from "./Entity";
import { PrimaryKey } from "./PrimaryKey";

describe("PrimaryKey Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @PrimaryKey(["givenName", "familyName"])
    class PrimaryKeyDecoratorEntity {
      @Column()
      givenName!: string;

      @Column()
      familyName!: string;
    }

    expect(globalEntityMetadata.get(PrimaryKeyDecoratorEntity)).toMatchSnapshot();
  });

  test("should add metadata with string", () => {
    @Entity()
    class PrimaryKeyDecoratorPropertyEntity {
      @Column()
      @PrimaryKey()
      id!: string;
    }

    expect(globalEntityMetadata.get(PrimaryKeyDecoratorPropertyEntity)).toMatchSnapshot();
  });
});
