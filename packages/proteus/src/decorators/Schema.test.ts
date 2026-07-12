import { z } from "zod";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { Schema } from "./Schema.js";
import { describe, expect, test } from "vitest";

const nameSchema = z.object({
  name: z.string().min(1).max(100),
});

const emailSchema = z.object({
  email: z.string().email(),
});

const settingsSchema = z.object({
  theme: z.enum(["light", "dark"]),
});

@Entity({ name: "SchemaDecorated" })
@Schema(nameSchema)
class SchemaDecorated {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "SchemaMultiple" })
@Schema(nameSchema)
@Schema(emailSchema)
class SchemaMultiple {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Field("string")
  email!: string;
}

@Entity({ name: "SchemaFieldLevel" })
class SchemaFieldLevel {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Schema(settingsSchema)
  @Field("json")
  settings!: { theme: string };

  @Schema(z.array(z.string()))
  @Field("array")
  tags!: Array<string>;
}

@Entity({ name: "SchemaBothKinds" })
@Schema(nameSchema)
class SchemaBothKinds {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Schema(settingsSchema)
  @Field("object")
  settings!: { theme: string };
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

  test("should register field-level schemas on field metadata", () => {
    const meta = getEntityMetadata(SchemaFieldLevel);
    const settings = meta.fields.find((f) => f.key === "settings");
    const tags = meta.fields.find((f) => f.key === "tags");
    expect(settings?.schema).toBe(settingsSchema);
    expect(tags?.schema).toBeInstanceOf(z.ZodArray);
    expect(meta.schemas.length).toBe(0);
  });

  test("should register class-level and field-level schemas together", () => {
    const meta = getEntityMetadata(SchemaBothKinds);
    expect(meta.schemas).toEqual([nameSchema]);
    expect(meta.fields.find((f) => f.key === "settings")?.schema).toBe(settingsSchema);
  });

  test("should throw for field-level schema on a non-json field type", () => {
    @Entity({ name: "SchemaInvalidFieldType" })
    class SchemaInvalidFieldType {
      @PrimaryKeyField() @Generated("uuid") id!: string;

      @Schema(z.string())
      @Field("string")
      name!: string;
    }

    expect(() => getEntityMetadata(SchemaInvalidFieldType)).toThrow(
      '@Schema on "name" requires a "json", "object", or "array" field',
    );
  });

  test("should throw for duplicate field-level schemas on one property", () => {
    @Entity({ name: "SchemaDuplicateField" })
    class SchemaDuplicateField {
      @PrimaryKeyField() @Generated("uuid") id!: string;

      @Schema(settingsSchema)
      @Schema(settingsSchema)
      @Field("json")
      settings!: { theme: string };
    }

    expect(() => getEntityMetadata(SchemaDuplicateField)).toThrow(
      'Duplicate @Schema on property "settings"',
    );
  });

  test("should throw for field-level schema without a field decorator", () => {
    @Entity({ name: "SchemaMissingField" })
    class SchemaMissingField {
      @PrimaryKeyField() @Generated("uuid") id!: string;

      @Schema(settingsSchema)
      settings!: { theme: string };
    }

    expect(() => getEntityMetadata(SchemaMissingField)).toThrow(
      '@Schema on property "settings" requires a @Field decorator',
    );
  });

  test("should throw at decoration time for a class-level non-object schema", () => {
    expect(() => {
      // A JS consumer can pass any schema — the overload types don't protect them
      @Schema(z.array(z.string()) as any)
      @Entity({ name: "SchemaClassArray" })
      class SchemaClassArray {
        @PrimaryKeyField() @Generated("uuid") id!: string;
      }
      return SchemaClassArray;
    }).toThrow('Class-level @Schema on "SchemaClassArray" requires a Zod object schema');
  });

  test("should accept a class-level strict/loose object schema", () => {
    expect(() => {
      @Schema(z.strictObject({ name: z.string() }))
      @Entity({ name: "SchemaClassStrict" })
      class SchemaClassStrict {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Field("string")
        name!: string;
      }
      return getEntityMetadata(SchemaClassStrict);
    }).not.toThrow();
  });
});
