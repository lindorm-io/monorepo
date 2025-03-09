import { globalEntityMetadata } from "../utils";
import { Column } from "./Column";
import { Entity } from "./Entity";
import { Index } from "./Index_";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("Index Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @Index(["key"])
    @Index({ other: "asc" }, { name: "custom_name" })
    class IndexDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @Column()
      key!: string;

      @Column()
      other!: string;

      @Column({
        min: 0,
        max: 100,
        nullable: false,
      })
      @Index("2d", { options: { background: true } })
      third!: number;
    }

    expect(globalEntityMetadata.get(IndexDecoratorEntity)).toMatchSnapshot();
  });
});
