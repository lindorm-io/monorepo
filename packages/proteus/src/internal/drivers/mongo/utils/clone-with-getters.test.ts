import { Binary } from "mongodb";
import { deserialise } from "../../../entity/utils/deserialise.js";
import { cloneDocument } from "./clone-with-getters.js";
import { describe, expect, test } from "vitest";

describe("cloneDocument", () => {
  test("should clone a plain object", () => {
    const doc = { name: "foo", age: 42 };
    expect(cloneDocument(doc)).toMatchSnapshot();
  });

  test("should deep-clone nested objects", () => {
    const doc = { address: { city: "Stockholm", zip: "11122" } };
    const result = cloneDocument(doc);
    expect(result).toMatchSnapshot();
    expect(result.address).not.toBe(doc.address);
  });

  test("should clone arrays", () => {
    const doc = { tags: ["a", "b", "c"], nested: [{ x: 1 }] };
    const result = cloneDocument(doc);
    expect(result).toMatchSnapshot();
    expect(result.tags).not.toBe(doc.tags);
  });

  test("should preserve Date objects", () => {
    const doc = { createdAt: new Date("2024-01-01T00:00:00.000Z") };
    const result = cloneDocument(doc);
    expect(result).toMatchSnapshot();
  });

  test("should strip getters by deep-cloning", () => {
    const doc = Object.create(null);
    Object.defineProperty(doc, "hidden", {
      get: () => "secret",
      enumerable: true,
    });
    doc.visible = "yes";
    const result = cloneDocument(doc);
    // JSON.stringify calls the getter, so it should appear as a plain value
    expect(result).toMatchSnapshot();
  });

  test("should handle null values", () => {
    const doc = { name: null, nested: { val: null } };
    expect(cloneDocument(doc)).toMatchSnapshot();
  });

  test("should handle empty object", () => {
    expect(cloneDocument({})).toMatchSnapshot();
  });

  // These two pin down WHY MongoDriver sets `promoteBuffers: true` on the
  // client: structuredClone keeps a Buffer's bytes (as a Uint8Array, which
  // `deserialise` restores) but flattens a BSON Binary into a plain object it
  // cannot read. The fix has to happen at the driver, before cloning.
  test("should preserve the bytes of a Buffer value", () => {
    const bytes = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const result = cloneDocument({ blob: bytes });

    expect(deserialise(result.blob, "binary").equals(bytes)).toBe(true);
  });

  test("should flatten a BSON Binary beyond recovery", () => {
    const result = cloneDocument({ blob: new Binary(Buffer.from([0xde, 0xad])) });

    expect(result.blob).not.toBeInstanceOf(Binary);
    expect(() => deserialise(result.blob, "binary")).toThrow();
  });
});
