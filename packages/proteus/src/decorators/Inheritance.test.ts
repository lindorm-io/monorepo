import { Inheritance } from "./Inheritance.js";
import { describe, expect, test } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Test entities
// ─────────────────────────────────────────────────────────────────────────────

@Inheritance()
class InheritanceDefault {}

@Inheritance("single-table")
class InheritanceSingleTable {}

@Inheritance("joined")
class InheritanceJoined {}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Inheritance", () => {
  test("should stage __inheritance as 'single-table' when called with no arguments", () => {
    const meta = (InheritanceDefault as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__inheritance")).toBe(true);
    expect(meta.__inheritance).toMatchSnapshot();
  });

  test("should stage __inheritance as 'single-table' when explicitly provided", () => {
    const meta = (InheritanceSingleTable as any)[Symbol.metadata];
    expect(meta.__inheritance).toMatchSnapshot();
  });

  test("should stage __inheritance as 'joined' when joined strategy is provided", () => {
    const meta = (InheritanceJoined as any)[Symbol.metadata];
    expect(meta.__inheritance).toMatchSnapshot();
  });

  test("should stage __inheritance on own metadata object only", () => {
    const meta = (InheritanceDefault as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__inheritance")).toBe(true);
  });

  test("should not stage __inheritance on a class without the decorator", () => {
    class PlainClass {}
    const meta = (PlainClass as any)[Symbol.metadata];
    expect(meta?.__inheritance).toBeUndefined();
  });
});
