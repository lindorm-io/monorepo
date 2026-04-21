import { z } from "zod";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { Schema } from "./Schema.js";
import { describe, expect, test } from "vitest";

const nameSchema = z.object({
  name: z.string().min(1).max(100),
}) as any;

const emailSchema = z.object({
  email: z.string().email(),
}) as any;

@Entity({ name: "SchemaDecorated" })
@Schema(nameSchema)
class SchemaDecorated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "SchemaMultiple" })
@Schema(nameSchema)
@Schema(emailSchema)
class SchemaMultiple {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Field("string")
  email!: string;
}

describe("Schema", () => {
  test("should register schema decorator", () => {
    const meta = getEntityMetadata(SchemaDecorated);
    expect(meta.schemas.length).toBe(1);
    expect(meta.schemas[0]).toBe(nameSchema);
  });

  test("should register multiple schemas", () => {
    const meta = getEntityMetadata(SchemaMultiple);
    expect(meta.schemas.length).toBe(2);
    expect(meta.schemas).toContain(nameSchema);
    expect(meta.schemas).toContain(emailSchema);
  });
});
