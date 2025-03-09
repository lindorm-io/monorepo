import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { ExpiryDateColumn } from "./ExpiryDateColumn";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("ExpiryDateColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class ExpiryDateColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @ExpiryDateColumn()
      expiryDate!: Date | null;
    }

    expect(globalEntityMetadata.get(ExpiryDateColumnDecoratorEntity)).toMatchSnapshot();
  });
});
