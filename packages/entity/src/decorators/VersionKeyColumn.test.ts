import { globalEntityMetadata } from "../utils";
import { DeleteDateColumn } from "./DeleteDateColumn";
import { Entity } from "./Entity";
import { ExpiryDateColumn } from "./ExpiryDateColumn";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { VersionColumn } from "./VersionColumn";
import { VersionEndDateColumn } from "./VersionEndDateColumn";
import { VersionKeyColumn } from "./VersionKeyColumn";
import { VersionStartDateColumn } from "./VersionStartDateColumn";

describe("VersionKeyColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class VersionKeyColumnDecoratorEntity {
      @PrimaryKeyColumn()
      primaryKey!: string;

      @VersionKeyColumn()
      versionKey!: string;

      @VersionColumn()
      version!: number;

      @VersionStartDateColumn()
      versionStartDate!: Date;

      @VersionEndDateColumn()
      versionEndDate!: Date | null;

      @ExpiryDateColumn()
      expiryDate!: Date | null;

      @DeleteDateColumn()
      deleteDate!: Date | null;
    }

    expect(globalEntityMetadata.get(VersionKeyColumnDecoratorEntity)).toMatchSnapshot();
  });
});
