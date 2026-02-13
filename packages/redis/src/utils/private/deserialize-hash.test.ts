import { MetaColumn } from "@lindorm/entity";
import { Primitive } from "@lindorm/json-kit";
import { deserializeHash } from "./deserialize-hash";

const makeColumn = (key: string, type: MetaColumn["type"]): MetaColumn =>
  ({
    key,
    type,
    decorator: "Column",
    enum: null,
    fallback: null,
    max: null,
    min: null,
    nullable: false,
    optional: false,
    readonly: false,
    schema: null,
  }) as MetaColumn;

describe("deserializeHash", () => {
  test("should pass through string types", () => {
    const columns = [makeColumn("name", "string")];
    expect(deserializeHash({ name: "hello" }, columns)).toEqual({ name: "hello" });
  });

  test("should deserialize integer strings", () => {
    const columns = [makeColumn("count", "integer")];
    expect(deserializeHash({ count: "42" }, columns)).toEqual({ count: 42 });
  });

  test("should deserialize float strings", () => {
    const columns = [makeColumn("score", "float")];
    expect(deserializeHash({ score: "3.14" }, columns)).toEqual({ score: 3.14 });
  });

  test("should deserialize date strings", () => {
    const columns = [makeColumn("createdAt", "date")];
    const result = deserializeHash({ createdAt: "2024-01-01T08:00:00.000Z" }, columns);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect((result.createdAt as Date).toISOString()).toBe("2024-01-01T08:00:00.000Z");
  });

  test("should deserialize bigint strings", () => {
    const columns = [makeColumn("big", "bigint")];
    expect(deserializeHash({ big: "9007199254740993" }, columns)).toEqual({
      big: BigInt("9007199254740993"),
    });
  });

  test("should deserialize boolean true correctly", () => {
    const columns = [makeColumn("active", "boolean")];
    expect(deserializeHash({ active: "true" }, columns)).toEqual({ active: true });
  });

  test("should deserialize boolean false correctly", () => {
    const columns = [makeColumn("disabled", "boolean")];
    expect(deserializeHash({ disabled: "false" }, columns)).toEqual({ disabled: false });
  });

  test("should deserialize array types using Primitive", () => {
    const columns = [makeColumn("tags", "array")];
    const tags = ["a", "b", "c"];
    const serialized = new Primitive(tags).toString();
    expect(deserializeHash({ tags: serialized }, columns)).toEqual({ tags });
  });

  test("should deserialize object types using Primitive", () => {
    const columns = [makeColumn("meta", "object")];
    const meta = { foo: "bar" };
    const serialized = new Primitive(meta).toString();
    expect(deserializeHash({ meta: serialized }, columns)).toEqual({ meta });
  });

  test("should round-trip complex nested objects with dates via Primitive", () => {
    const columns = [makeColumn("meta", "object")];
    const original = {
      nested: { createdAt: new Date("2024-01-01T00:00:00.000Z") },
    };
    const serialized = new Primitive(original).toString();
    const result = deserializeHash({ meta: serialized }, columns);
    expect(result.meta).toEqual(original);
  });

  test("should handle missing fields as null", () => {
    const columns = [makeColumn("name", "string"), makeColumn("email", "string")];
    expect(deserializeHash({ name: "hello" }, columns)).toEqual({
      name: "hello",
      email: null,
    });
  });

  test("should passthrough FK columns without type metadata", () => {
    const columns = [makeColumn("name", "string")];
    expect(deserializeHash({ name: "hello", foreignId: "abc" }, columns)).toEqual({
      name: "hello",
      foreignId: "abc",
    });
  });

  test("should passthrough columns with null type", () => {
    const columns = [makeColumn("misc", null)];
    expect(deserializeHash({ misc: "raw-value" }, columns)).toEqual({
      misc: "raw-value",
    });
  });
});
