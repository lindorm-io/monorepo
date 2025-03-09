import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { VersionColumn } from "./VersionColumn";

describe("VersionColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class VersionColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @VersionColumn()
      version!: number;
    }

    expect(globalEntityMetadata.get(VersionColumnDecoratorEntity)).toMatchSnapshot();
  });
});
