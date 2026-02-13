import { MetaColumn } from "@lindorm/entity";
import { Primitive } from "@lindorm/json-kit";
import { serializeHash } from "./serialize-hash";

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

describe("serializeHash", () => {
  test("should serialize string types", () => {
    const columns = [makeColumn("name", "string")];
    expect(serializeHash({ name: "hello" }, columns)).toEqual({ name: "hello" });
  });

  test("should serialize uuid types", () => {
    const columns = [makeColumn("id", "uuid")];
    expect(serializeHash({ id: "abc-123" }, columns)).toEqual({ id: "abc-123" });
  });

  test("should serialize integer types", () => {
    const columns = [makeColumn("count", "integer")];
    expect(serializeHash({ count: 42 }, columns)).toEqual({ count: "42" });
  });

  test("should serialize float types", () => {
    const columns = [makeColumn("score", "float")];
    expect(serializeHash({ score: 3.14 }, columns)).toEqual({ score: "3.14" });
  });

  test("should serialize bigint types", () => {
    const columns = [makeColumn("big", "bigint")];
    expect(serializeHash({ big: BigInt("9007199254740993") }, columns)).toEqual({
      big: "9007199254740993",
    });
  });

  test("should serialize boolean types", () => {
    const columns = [makeColumn("active", "boolean"), makeColumn("disabled", "boolean")];
    expect(serializeHash({ active: true, disabled: false }, columns)).toEqual({
      active: "true",
      disabled: "false",
    });
  });

  test("should serialize date types", () => {
    const columns = [makeColumn("createdAt", "date")];
    const date = new Date("2024-01-01T08:00:00.000Z");
    expect(serializeHash({ createdAt: date }, columns)).toEqual({
      createdAt: "2024-01-01T08:00:00.000Z",
    });
  });

  test("should serialize array types using Primitive", () => {
    const columns = [makeColumn("tags", "array")];
    const tags = ["a", "b", "c"];
    const result = serializeHash({ tags }, columns);
    expect(result.tags).toEqual(new Primitive(tags).toString());
  });

  test("should serialize object types using Primitive", () => {
    const columns = [makeColumn("meta", "object")];
    const meta = { foo: "bar", nested: { date: new Date("2024-01-01T00:00:00.000Z") } };
    const result = serializeHash({ meta }, columns);
    expect(result.meta).toEqual(new Primitive(meta).toString());
  });

  test("should omit null values", () => {
    const columns = [makeColumn("name", "string")];
    expect(serializeHash({ name: null }, columns)).toEqual({});
  });

  test("should omit undefined values", () => {
    const columns = [makeColumn("name", "string")];
    expect(serializeHash({ name: undefined }, columns)).toEqual({});
  });

  test("should serialize FK columns without type metadata as strings", () => {
    const columns: Array<MetaColumn> = [];
    expect(serializeHash({ foreignId: "abc-123" }, columns)).toEqual({
      foreignId: "abc-123",
    });
  });

  test("should handle enum types as strings", () => {
    const columns = [makeColumn("status", "enum")];
    expect(serializeHash({ status: "active" }, columns)).toEqual({ status: "active" });
  });

  test("should handle multiple columns", () => {
    const columns = [
      makeColumn("id", "uuid"),
      makeColumn("name", "string"),
      makeColumn("version", "integer"),
      makeColumn("active", "boolean"),
      makeColumn("createdAt", "date"),
    ];
    const date = new Date("2024-01-01T08:00:00.000Z");
    expect(
      serializeHash(
        { id: "abc", name: "test", version: 1, active: true, createdAt: date },
        columns,
      ),
    ).toEqual({
      id: "abc",
      name: "test",
      version: "1",
      active: "true",
      createdAt: "2024-01-01T08:00:00.000Z",
    });
  });
});
