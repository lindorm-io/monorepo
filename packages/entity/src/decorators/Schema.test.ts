import { z } from "zod";
import { globalEntityMetadata } from "../utils";
import { Entity } from "./Entity";
import { PrimaryKeyColumn } from "./PrimaryKeyColumn";
import { Schema } from "./Schema";

describe("Schema Decorator", () => {
  test("should add metadata", () => {
    @Entity()
    @Schema(z.object({ name: z.string() }))
    class SchemaDecoratorEntity {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(globalEntityMetadata.get(SchemaDecoratorEntity)).toMatchSnapshot();
  });
});
