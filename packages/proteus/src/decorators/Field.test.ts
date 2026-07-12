import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { Max } from "./Max.js";
import { Nullable } from "./Nullable.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "FieldStringType" })
class FieldStringType {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "FieldWithName" })
class FieldWithName {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string", { name: "display_name" })
  displayName!: string;
}

@Entity({ name: "FieldIntegerType" })
class FieldIntegerType {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("integer")
  count!: number;
}

@Entity({ name: "FieldNamedFlag" })
class FieldNamedFlag {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  plain!: string;

  // Explicit column name that happens to equal the property key.
  @Field("string", { name: "createdAt" })
  createdAt!: string;

  // Explicit name stacked with a field modifier — `named` must survive the merge.
  @Field("string", { name: "display_name" })
  @Nullable()
  displayName!: string;
}

@Entity({ name: "FieldLindormIdMaxStages" })
class FieldLindormIdMaxStages {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  // Explicit @Max wins
  @Max(64)
  @Field("lindorm_id")
  explicitMax!: string;

  // Derived from the paired @Generated (namespace + "_" + length)
  @Field("lindorm_id")
  @Generated("lindorm_id", { namespace: "user", length: 32 })
  derivedMax!: string;

  // Bare — defaults to 255
  @Field("lindorm_id")
  bareDefault!: string;
}

describe("Field", () => {
  test("should register string field", () => {
    const meta = getEntityMetadata(FieldStringType);
    const field = meta.fields.find((f) => f.key === "name");
    expect(field).toBeDefined();
    expect(field!.type).toBe("string");
    expect(field!.decorator).toBe("Field");
  });

  test("should register field with custom column name", () => {
    const meta = getEntityMetadata(FieldWithName);
    const field = meta.fields.find((f) => f.key === "displayName");
    expect(field).toBeDefined();
    expect(field!.name).toBe("display_name");
    expect(field!.type).toBe("string");
  });

  test("should register integer field", () => {
    expect(getEntityMetadata(FieldIntegerType)).toMatchSnapshot();
  });

  test("should default nullable to false", () => {
    const meta = getEntityMetadata(FieldStringType);
    const field = meta.fields.find((f) => f.key === "name");
    expect(field!.nullable).toBe(false);
  });

  test("should default readonly to false", () => {
    const meta = getEntityMetadata(FieldStringType);
    const field = meta.fields.find((f) => f.key === "name");
    expect(field!.readonly).toEqual([]);
  });

  test("should set named:false when no explicit column name is given", () => {
    const meta = getEntityMetadata(FieldNamedFlag);
    const field = meta.fields.find((f) => f.key === "plain")!;
    expect(field.named).toBe(false);
  });

  test("should set named:true for an explicit name equal to the property key", () => {
    const meta = getEntityMetadata(FieldNamedFlag);
    const field = meta.fields.find((f) => f.key === "createdAt")!;
    expect(field.name).toBe("createdAt");
    expect(field.named).toBe(true);
  });

  test("should preserve named:true when stacked with a field modifier", () => {
    const meta = getEntityMetadata(FieldNamedFlag);
    const field = meta.fields.find((f) => f.key === "displayName")!;
    expect(field.name).toBe("display_name");
    expect(field.named).toBe(true);
    expect(field.nullable).toBe(true); // @Nullable applied, named not clobbered
  });

  test("should default all modifier fields to zero-values", () => {
    const meta = getEntityMetadata(FieldStringType);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.enum).toBeNull();
    expect(field.default).toBeNull();
    expect(field.max).toBeNull();
    expect(field.min).toBeNull();
    expect(field.schema).toBeNull();
    expect(field.computed).toBeNull();
    expect(field.comment).toBeNull();
    expect(field.hideOn).toEqual([]);
  });

  test("should resolve lindorm_id max in stages: explicit > derived > default 255", () => {
    const meta = getEntityMetadata(FieldLindormIdMaxStages);
    expect(meta.fields.find((f) => f.key === "explicitMax")!.max).toBe(64);
    expect(meta.fields.find((f) => f.key === "derivedMax")!.max).toBe(37);
    expect(meta.fields.find((f) => f.key === "bareDefault")!.max).toBe(255);
    expect(meta).toMatchSnapshot();
  });
});
