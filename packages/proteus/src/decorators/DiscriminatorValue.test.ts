import { DiscriminatorValue } from "./DiscriminatorValue";
import { describe, expect, test } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Test entities
// ─────────────────────────────────────────────────────────────────────────────

@DiscriminatorValue("car")
class DiscriminatorValueString {}

@DiscriminatorValue("truck")
class DiscriminatorValueAnotherString {}

@DiscriminatorValue(1)
class DiscriminatorValueNumber {}

@DiscriminatorValue(42)
class DiscriminatorValueLargeNumber {}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("DiscriminatorValue", () => {
  test("should stage __discriminatorValue with string value 'car'", () => {
    const meta = (DiscriminatorValueString as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__discriminatorValue")).toBe(true);
    expect(meta.__discriminatorValue).toMatchSnapshot();
  });

  test("should stage __discriminatorValue with another string value 'truck'", () => {
    const meta = (DiscriminatorValueAnotherString as any)[Symbol.metadata];
    expect(meta.__discriminatorValue).toMatchSnapshot();
  });

  test("should stage __discriminatorValue with numeric value 1", () => {
    const meta = (DiscriminatorValueNumber as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__discriminatorValue")).toBe(true);
    expect(meta.__discriminatorValue).toMatchSnapshot();
  });

  test("should stage __discriminatorValue with numeric value 42", () => {
    const meta = (DiscriminatorValueLargeNumber as any)[Symbol.metadata];
    expect(meta.__discriminatorValue).toMatchSnapshot();
  });

  test("should store the exact string value on metadata", () => {
    const meta = (DiscriminatorValueString as any)[Symbol.metadata];
    expect(meta.__discriminatorValue).toBe("car");
  });

  test("should store the exact numeric value on metadata", () => {
    const meta = (DiscriminatorValueNumber as any)[Symbol.metadata];
    expect(meta.__discriminatorValue).toBe(1);
  });

  test("should stage __discriminatorValue on own metadata object only", () => {
    const meta = (DiscriminatorValueString as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__discriminatorValue")).toBe(true);
  });

  test("should not stage __discriminatorValue on a class without the decorator", () => {
    class PlainClass {}
    const meta = (PlainClass as any)[Symbol.metadata];
    expect(meta?.__discriminatorValue).toBeUndefined();
  });

  test("should throw TypeError when decorator is applied with null value", () => {
    expect(() => {
      // The guard runs inside the returned decorator, so apply it to a class
      const applyDecorator = DiscriminatorValue(null as any);
      applyDecorator(class Test {}, { metadata: {}, kind: "class", name: "Test" } as any);
    }).toThrow(TypeError);
  });

  test("should throw TypeError when decorator is applied with undefined value", () => {
    expect(() => {
      const applyDecorator = DiscriminatorValue(undefined as any);
      applyDecorator(class Test {}, { metadata: {}, kind: "class", name: "Test" } as any);
    }).toThrow(TypeError);
  });

  test("should throw TypeError with a descriptive message when null value is applied", () => {
    expect(() => {
      const applyDecorator = DiscriminatorValue(null as any);
      applyDecorator(class Test {}, { metadata: {}, kind: "class", name: "Test" } as any);
    }).toThrow("@DiscriminatorValue requires a string or number");
  });

  test("should throw TypeError with a descriptive message when object value is applied", () => {
    expect(() => {
      const applyDecorator = DiscriminatorValue({} as any);
      applyDecorator(class Test {}, { metadata: {}, kind: "class", name: "Test" } as any);
    }).toThrow("@DiscriminatorValue requires a string or number");
  });

  test("should throw TypeError when decorator is applied with a boolean value", () => {
    expect(() => {
      const applyDecorator = DiscriminatorValue(true as any);
      applyDecorator(class Test {}, { metadata: {}, kind: "class", name: "Test" } as any);
    }).toThrow(TypeError);
  });

  test("should throw TypeError when decorator is applied with an array value", () => {
    expect(() => {
      const applyDecorator = DiscriminatorValue([] as any);
      applyDecorator(class Test {}, { metadata: {}, kind: "class", name: "Test" } as any);
    }).toThrow(TypeError);
  });
});
