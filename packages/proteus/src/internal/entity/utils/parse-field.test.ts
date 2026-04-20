import { makeField } from "../../__fixtures__/make-field";
import { parseField } from "./parse-field";
import { describe, expect, test, vi } from "vitest";

describe("parseField", () => {
  test("should prefer options value over entity value", () => {
    const field = makeField("name", { type: "string" });
    const entity = { name: "original" } as any;
    const options = { name: "override" } as any;
    expect(parseField(field, entity, options)).toBe("override");
  });

  test("should fall back to entity value when options has no key", () => {
    const field = makeField("name", { type: "string" });
    const entity = { name: "from-entity" } as any;
    expect(parseField(field, entity, {})).toBe("from-entity");
  });

  test("should return null for nullable field with null value", () => {
    const field = makeField("email", { type: "string", nullable: true });
    const entity = { email: null } as any;
    expect(parseField(field, entity, {})).toBeNull();
  });

  test("should return static default when value is null and default set", () => {
    const field = makeField("age", { type: "integer", default: 42 });
    const entity = {} as any;
    expect(parseField(field, entity, {})).toBe(42);
  });

  test("should call function default when value is null and default is function", () => {
    const defaultFn = vi.fn().mockReturnValue(99);
    const field = makeField("count", { type: "integer", default: defaultFn });
    const entity = {} as any;
    const result = parseField(field, entity, {});
    expect(defaultFn).toHaveBeenCalled();
    expect(result).toBe(99);
  });

  test("should deserialise string to integer", () => {
    const field = makeField("age", { type: "integer" });
    const entity = {} as any;
    expect(parseField(field, entity, { age: "25" } as any)).toBe(25);
  });

  test("should deserialise string to boolean", () => {
    const field = makeField("active", { type: "boolean" });
    const entity = {} as any;
    expect(parseField(field, entity, { active: "true" } as any)).toBe(true);
  });

  test("should throw EntityManagerError for invalid type conversion", () => {
    const field = makeField("count", { type: "integer" });
    const entity = {} as any;
    expect(() => parseField(field, entity, { count: "not-a-number" } as any)).toThrow(
      'Failed to parse field "count" of type integer',
    );
  });

  test("should return null when both null field check is false and default is null", () => {
    const field = makeField("name", { type: "string", nullable: false, default: null });
    const entity = { name: null } as any;
    // null value, not nullable, no default — returns null
    expect(parseField(field, entity, {})).toBeNull();
  });
});
