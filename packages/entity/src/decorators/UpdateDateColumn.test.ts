import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { UpdateDateColumn } from "./UpdateDateColumn";

describe("UpdateDateColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class UpdateDateColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @UpdateDateColumn()
      updateDate!: Date;
    }

    expect(globalEntityMetadata.get(UpdateDateColumnDecoratorEntity)).toMatchSnapshot();
  });
});
