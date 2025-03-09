import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { VersionStartDateColumn } from "./VersionStartDateColumn";

describe("VersionStartDateColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class VersionStartDateColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @VersionStartDateColumn()
      versionStartDate!: Date;
    }

    expect(
      globalEntityMetadata.get(VersionStartDateColumnDecoratorEntity),
    ).toMatchSnapshot();
  });
});
