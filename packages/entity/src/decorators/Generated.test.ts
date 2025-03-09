import { globalEntityMetadata } from "../utils";
import { Column } from "./Column";
import { Entity } from "./Entity";
import { Generated } from "./Generated";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";

describe("Generated Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    class GeneratedDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;

      @Column()
      @Generated("increment")
      one!: string;

      @Column()
      @Generated({ strategy: "integer", max: 4, min: 4 })
      two!: string;

      @Column()
      @Generated({ strategy: "string", length: 32 })
      three!: number;
    }

    expect(globalEntityMetadata.get(GeneratedDecoratorEntity)).toMatchSnapshot();
  });
});
