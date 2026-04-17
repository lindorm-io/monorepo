import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "FieldStringType" })
class FieldStringType {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "FieldWithName" })
class FieldWithName {
  @PrimaryKeyField()
  id!: string;

  @Field("string", { name: "display_name" })
  displayName!: string;
}

@Entity({ name: "FieldIntegerType" })
class FieldIntegerType {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  count!: number;
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
    expect(field!.readonly).toBe(false);
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
});
