import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { MetaField } from "../types/metadata.js";
import { parseField } from "./parse-field.js";
import { describe, expect, it } from "vitest";

const createField = (overrides: Partial<MetaField> = {}): MetaField => ({
  key: "testKey",
  decorator: "Field",
  default: null,
  enum: null,
  max: null,
  min: null,
  nullable: false,
  optional: false,
  schema: null,
  transform: null,
  type: "string",
  ...overrides,
});

describe("parseField", () => {
  describe("value provided in options", () => {
    it("should return deserialised value from options", () => {
      const field = createField({ key: "name", type: "string" });
      expect(parseField(field, {}, { name: "hello" })).toMatchSnapshot();
    });

    it("should deserialise the value according to field type", () => {
      const field = createField({ key: "count", type: "integer" });
      expect(parseField(field, {}, { count: "42" })).toMatchSnapshot();
    });

    it("should prefer options over message", () => {
      const field = createField({ key: "name", type: "string" });
      expect(
        parseField(field, { name: "from-message" }, { name: "from-options" }),
      ).toMatchSnapshot();
    });
  });

  describe("value from message (not in options)", () => {
    it("should use message value when not present in options", () => {
      const field = createField({ key: "name", type: "string" });
      expect(parseField(field, { name: "from-message" }, {})).toMatchSnapshot();
    });

    it("should deserialise the message value", () => {
      const field = createField({ key: "count", type: "integer" });
      expect(parseField(field, { count: "99" }, {})).toMatchSnapshot();
    });
  });

  describe("function default", () => {
    it("should call function default when value is undefined", () => {
      const defaultFn = () => "generated-value";
      const field = createField({ key: "name", default: defaultFn });
      expect(parseField(field, {}, {})).toMatchSnapshot();
    });

    it("should call function default when value is null and not nullable", () => {
      const defaultFn = () => "fallback";
      const field = createField({ key: "name", default: defaultFn, nullable: false });
      expect(parseField(field, { name: null }, {})).toMatchSnapshot();
    });
  });

  describe("static default", () => {
    it("should return static default when value is undefined", () => {
      const field = createField({ key: "status", default: "active" });
      expect(parseField(field, {}, {})).toMatchSnapshot();
    });

    it("should return numeric static default", () => {
      const field = createField({ key: "count", default: 0 });
      expect(parseField(field, {}, {})).toMatchSnapshot();
    });

    it("should return boolean static default", () => {
      const field = createField({ key: "enabled", default: false });
      expect(parseField(field, {}, {})).toMatchSnapshot();
    });
  });

  describe("nullable field with no default", () => {
    it("should return null when value is undefined and field is nullable", () => {
      const field = createField({ key: "optional", nullable: true });
      expect(parseField(field, {}, {})).toMatchSnapshot();
    });

    it("should return null when value is null and field is nullable", () => {
      const field = createField({ key: "optional", nullable: true });
      expect(parseField(field, { optional: null }, {})).toMatchSnapshot();
    });
  });

  describe("explicit null in options", () => {
    it("should preserve null when nullable", () => {
      const field = createField({ key: "name", nullable: true });
      expect(parseField(field, {}, { name: null })).toMatchSnapshot();
    });

    it("should apply default when null in options and not nullable but has default", () => {
      const field = createField({ key: "name", nullable: false, default: "fallback" });
      expect(parseField(field, {}, { name: null })).toMatchSnapshot();
    });
  });

  describe("no value, no default, not nullable (edge case)", () => {
    // Finding #12: when the field has no default and is not nullable,
    // and the value is undefined, parseField returns undefined.
    // This is a known edge case — the caller is expected to handle
    // validation elsewhere (e.g., schema validation).
    it("should return undefined when value is missing with no default and not nullable", () => {
      const field = createField({ key: "required", nullable: false, default: null });
      expect(parseField(field, {}, {})).toMatchSnapshot();
    });
  });

  describe("deserialisation error wrapping", () => {
    it("should wrap deserialisation errors in IrisSerializationError with field context", () => {
      const field = createField({ key: "startDate", type: "date" });
      expect(() => parseField(field, {}, { startDate: "not-a-date" })).toThrow(
        IrisSerializationError,
      );
    });

    it("should include field key in the error message", () => {
      const field = createField({ key: "amount", type: "integer" });
      expect(() => parseField(field, {}, { amount: "abc" })).toThrow(/amount/);
    });
  });
});
