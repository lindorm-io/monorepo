import { globalEntityMetadata } from "../utils";
import { DeleteDateColumn } from "./DeleteDateColumn";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("DeleteDateColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class DeleteDateColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @DeleteDateColumn()
      deleteDate!: Date | null;
    }

    expect(globalEntityMetadata.get(DeleteDateColumnDecoratorEntity)).toMatchSnapshot();
  });
});
