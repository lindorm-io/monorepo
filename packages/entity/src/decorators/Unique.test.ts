import { globalEntityMetadata } from "../utils";
import { Column } from "./Column";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { Unique } from "./Unique";

describe("Unique Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @Unique(["key"], { name: "custom_key_name" })
    @Unique(["key", "other"], { name: "custom_name" })
    @Unique(["key", "other", "third"])
    class UniqueDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @Column()
      key!: string;

      @Column()
      other!: string;

      @Column()
      @Unique()
      third!: number;
    }

    expect(globalEntityMetadata.get(UniqueDecoratorEntity)).toMatchSnapshot();
  });
});
