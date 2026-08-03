import { describe, expect, test } from "vitest";
import type { MetaField } from "../../../entity/types/metadata.js";
import { coerceHashValue } from "./coerce-hash-value.js";

const makeField = (overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key: "val",
    decorator: "Field",
    type: "string",
    computed: null,
    embedded: null,
    encrypted: null,
    transform: null,
    typedJson: null,
    nullable: false,
    readonly: [],
    ...overrides,
  }) as unknown as MetaField;

describe("coerceHashValue", () => {
  test.each([
    ["json", { a: 1, b: { c: 2 } }],
    ["object", { theme: "dark", count: 1 }],
    ["array", ["a", "b"]],
  ] as const)(
    "should serialize a %s value as JSON, never [object Object]",
    (type, value) => {
      const result = coerceHashValue(value, makeField({ type }));

      expect(result).not.toBe("[object Object]");
      expect(JSON.parse(result)).toEqual(value);
    },
  );

  test("should base64-encode a binary value", () => {
    expect(coerceHashValue(Buffer.from("hello"), makeField({ type: "binary" }))).toBe(
      Buffer.from("hello").toString("base64"),
    );
  });

  test("should serialize a Date as an ISO string", () => {
    expect(
      coerceHashValue(
        new Date("2024-06-01T12:34:56.789Z"),
        makeField({ type: "timestamp" }),
      ),
    ).toBe("2024-06-01T12:34:56.789Z");
  });

  test.each([
    [true, "true"],
    [false, "false"],
  ])("should serialize boolean %s", (value, expected) => {
    expect(coerceHashValue(value, makeField({ type: "boolean" }))).toBe(expected);
  });

  test("should serialize a bigint without precision loss", () => {
    expect(coerceHashValue(9007199254740993n, makeField({ type: "bigint" }))).toBe(
      "9007199254740993",
    );
  });

  test("should serialize a bigint array element without throwing", () => {
    expect(
      coerceHashValue([1n, 2n], makeField({ type: "array", arrayType: "bigint" })),
    ).toMatchSnapshot();
  });

  test("should pass encrypted ciphertext through untouched", () => {
    // The ciphertext is a string; the json branch would stringify it a second time.
    const field = makeField({ type: "json", encrypted: { condition: {} } as any });

    expect(coerceHashValue("aes:abc123", field)).toBe("aes:abc123");
  });

  test("should serialize a structured value on an unknown/absent field", () => {
    expect(coerceHashValue({ a: 1 }, null)).toBe('{"a":1}');
  });

  test("should stringify a scalar on an unknown/absent field", () => {
    expect(coerceHashValue(42, null)).toBe("42");
  });
});
