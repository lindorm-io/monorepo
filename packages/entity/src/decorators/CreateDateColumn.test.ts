import { globalEntityMetadata } from "../utils";
import { CreateDateColumn } from "./CreateDateColumn";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("CreateDateColumn Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class CreateDateColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @CreateDateColumn()
      createDate!: Date;
    }

    expect(globalEntityMetadata.get(CreateDateColumnDecoratorEntity)).toMatchSnapshot();
  });
});
