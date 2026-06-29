import { describe, expect, test } from "vitest";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { joinTypedJson, splitTypedJson } from "../internal/entity/utils/typed-json.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { Nullable } from "./Nullable.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { TypedJson } from "./TypedJson.js";

@Entity({ name: "TypedJsonDefault" })
class TypedJsonDefault {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @TypedJson()
  @Field("json")
  payload!: Record<string, unknown>;
}

@Entity({ name: "TypedJsonNamed" })
class TypedJsonNamed {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @TypedJson({ name: "meta_types" })
  @Field("object")
  meta!: Record<string, unknown>;
}

@Entity({ name: "TypedJsonNullable" })
class TypedJsonNullable {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Nullable()
  @TypedJson()
  @Field("array")
  items!: unknown[] | null;
}

@Entity({ name: "TypedJsonNotDecorated" })
class TypedJsonNotDecorated {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("json")
  plain!: Record<string, unknown>;
}

describe("TypedJson", () => {
  test("should stage typedJson with default sidecar column <col>__typemeta", () => {
    const meta = getEntityMetadata(TypedJsonDefault);
    const field = meta.fields.find((f) => f.key === "payload")!;
    expect(field.typedJson).toEqual({ name: null, column: "payload__typemeta" });
  });

  test("should honor an explicit sidecar column name verbatim", () => {
    const meta = getEntityMetadata(TypedJsonNamed);
    const field = meta.fields.find((f) => f.key === "meta")!;
    expect(field.typedJson).toEqual({ name: "meta_types", column: "meta_types" });
  });

  test("should stage typedJson on a nullable array field", () => {
    const meta = getEntityMetadata(TypedJsonNullable);
    const field = meta.fields.find((f) => f.key === "items")!;
    expect(field.typedJson).toEqual({ name: null, column: "items__typemeta" });
  });

  test("should default typedJson to null when not decorated", () => {
    const meta = getEntityMetadata(TypedJsonNotDecorated);
    const field = meta.fields.find((f) => f.key === "plain")!;
    expect(field.typedJson).toBeNull();
  });

  test("should match full metadata snapshot for a typed-json entity", () => {
    expect(getEntityMetadata(TypedJsonDefault)).toMatchSnapshot();
  });

  test("should reject @TypedJson on a non-json/object/array field", () => {
    @Entity({ name: "TypedJsonBadType" })
    class TypedJsonBadType {
      @PrimaryKeyField() @Generated("uuid") id!: string;

      @TypedJson()
      @Field("string")
      bad!: string;
    }

    expect(() => getEntityMetadata(TypedJsonBadType)).toThrow(/TypedJson/);
  });
});

describe("splitTypedJson / joinTypedJson", () => {
  test("should split and re-join Date / Buffer / BigInt / undefined losslessly", () => {
    const value = {
      when: new Date("2021-06-15T10:30:00.000Z"),
      blob: Buffer.from("hi"),
      big: 42n,
      maybe: undefined,
      plain: "x",
    };

    const { data, meta } = splitTypedJson(value);
    expect(typeof meta).toBe("string");

    const back = joinTypedJson(data, meta) as any;
    expect(back.when).toBeInstanceOf(Date);
    expect(Buffer.isBuffer(back.blob)).toBe(true);
    expect(typeof back.big).toBe("bigint");
    expect("maybe" in back).toBe(true);
    expect(back.maybe).toBeUndefined();
    expect(back.plain).toBe("x");
  });

  test("should write null data and null meta for null/undefined values", () => {
    expect(splitTypedJson(null)).toEqual({ data: null, meta: null });
    expect(splitTypedJson(undefined)).toEqual({ data: null, meta: null });
  });

  test("should fall back to plain data when the sidecar meta is missing", () => {
    const data = { a: 1, b: "two" };
    expect(joinTypedJson(data, null)).toEqual(data);
    expect(joinTypedJson(data, undefined)).toEqual(data);
  });

  test("should fall back to plain data when the sidecar meta is corrupt", () => {
    const data = { a: 1 };
    expect(joinTypedJson(data, "not json")).toEqual(data);
    expect(joinTypedJson(data, "{}")).toEqual(data);
  });

  test("should parse a stringified data column before joining", () => {
    const { data, meta } = splitTypedJson({ at: new Date("2020-01-01T00:00:00.000Z") });
    const back = joinTypedJson(JSON.stringify(data), meta) as any;
    expect(back.at).toBeInstanceOf(Date);
  });
});
