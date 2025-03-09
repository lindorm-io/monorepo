import { globalEntityMetadata } from "../utils";
import { Column } from "./Column";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("Column Decorator", () => {
  test("should add metadata", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Entity()
    class ColumnDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @Column({
        nullable: true,
        readonly: true,
      })
      name!: string;

      @Column()
      empty!: boolean;

      @Column()
      array!: Array<string>;

      @Column({ nullable: true })
      boolean!: boolean | null;

      @Column("date", { readonly: true })
      date!: Date;

      @Column("enum", { enum: TestEnum })
      enum!: TestEnum;
    }

    expect(globalEntityMetadata.get(ColumnDecoratorEntity)).toMatchSnapshot();
  });
});
