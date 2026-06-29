import {
  TEST_ARRAY_STRING,
  TEST_DICT,
  TEST_DICT_STRING,
} from "../__fixtures__/test-data.js";
import { JsonKit } from "./JsonKit.js";
import { Primitive } from "./Primitive.js";
import { describe, expect, test } from "vitest";

describe("JsonKit", () => {
  test("should create a primitive buffer from json data", () => {
    expect(JsonKit.buffer(TEST_DICT).toString("base64")).toMatchSnapshot();
  });

  test("should parse a primitive string (array) to json data", () => {
    expect(JsonKit.parse(TEST_ARRAY_STRING)).toMatchSnapshot();
  });

  test("should parse a primitive string (json) to json data", () => {
    expect(JsonKit.parse(TEST_DICT_STRING)).toMatchSnapshot();
  });

  test("should create a Primitive instance from json data", () => {
    expect(JsonKit.primitive(TEST_DICT)).toBeInstanceOf(Primitive);
  });

  test("should create a primitive string from json data", () => {
    expect(JsonKit.stringify(TEST_DICT)).toMatchSnapshot();
  });

  describe("split / join", () => {
    test("split then join round-trips Date/Buffer/undefined losslessly", () => {
      const { data, meta } = JsonKit.split(TEST_DICT);
      expect(JsonKit.join(data, meta)).toEqual(TEST_DICT);
    });

    test("split then join round-trips a BigInt", () => {
      const value = { big: BigInt("9007199254740993"), n: 1 };
      const { data, meta } = JsonKit.split(value);
      const restored = JsonKit.join<typeof value>(data, meta);
      expect(restored.big).toBe(BigInt("9007199254740993"));
      expect(typeof restored.big).toBe("bigint");
    });

    test("split round-trips a top-level array", () => {
      const value = [new Date("2020-01-01T08:00:00.000Z"), "x", 2];
      const { data, meta } = JsonKit.split(value);
      expect(JsonKit.join(data, meta)).toEqual(value);
    });

    test("split data is JSON-safe (Date as string) so it stays queryable", () => {
      const { data } = JsonKit.split({ when: new Date("2020-01-01T08:00:00.000Z") });
      // Must not throw (a raw Date/BigInt in the object would break jsonb storage).
      const json = JSON.stringify(data);
      expect(typeof JSON.parse(json).when).toBe("string");
    });

    // NOTE: join is strict — it assumes a matched (data, meta) pair and throws on
    // a stale/empty meta. Lenient reconstruction (fall back to JSON.parse on a
    // mismatched sidecar) is the consumer's responsibility, e.g. proteus's read
    // path. Kept here as an explicit contract.
    test("join is strict: a mismatched/empty meta throws (consumer must fall back)", () => {
      const { data } = JsonKit.split({ when: new Date("2020-01-01T08:00:00.000Z") });
      expect(() => JsonKit.join(data, {})).toThrow();
    });
  });
});
