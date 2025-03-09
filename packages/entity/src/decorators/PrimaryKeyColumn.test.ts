import { globalEntityMetadata } from "../utils";
import { DeleteDateColumn } from "./DeleteDateColumn";
import { Entity } from "./Entity";
import { ExpiryDateColumn } from "./ExpiryDateColumn";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { VersionColumn } from "./VersionColumn";

describe("PrimaryKeyColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class PrimaryKeyColumnDecoratorEntity {
      @PrimaryKeyColumn()
      primaryKey!: string;

      @VersionColumn()
      version!: number;

      @ExpiryDateColumn()
      expiryDate!: Date | null;

      @DeleteDateColumn()
      deleteDate!: Date | null;
    }

    expect(globalEntityMetadata.get(PrimaryKeyColumnDecoratorEntity)).toMatchSnapshot();
  });
});
