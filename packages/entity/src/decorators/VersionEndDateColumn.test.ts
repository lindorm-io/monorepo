import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { VersionEndDateColumn } from "./VersionEndDateColumn";

describe("VersionEndDateColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class VersionEndDateColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @VersionEndDateColumn()
      versionEndDate!: Date | null;
    }

    expect(
      globalEntityMetadata.get(VersionEndDateColumnDecoratorEntity),
    ).toMatchSnapshot();
  });
});
