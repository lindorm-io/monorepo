import { Discriminator } from "./Discriminator";
import { describe, expect, test } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Test entities
// ─────────────────────────────────────────────────────────────────────────────

@Discriminator("type")
class DiscriminatorOnType {
  type!: string;
}

@Discriminator("kind")
class DiscriminatorOnKind {
  kind!: string;
}

@Discriminator("vehicleType")
class DiscriminatorOnVehicleType {
  vehicleType!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Discriminator", () => {
  test("should stage __discriminator with fieldName 'type'", () => {
    const meta = (DiscriminatorOnType as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__discriminator")).toBe(true);
    expect(meta.__discriminator).toMatchSnapshot();
  });

  test("should stage __discriminator with fieldName 'kind'", () => {
    const meta = (DiscriminatorOnKind as any)[Symbol.metadata];
    expect(meta.__discriminator).toMatchSnapshot();
  });

  test("should stage __discriminator with fieldName 'vehicleType'", () => {
    const meta = (DiscriminatorOnVehicleType as any)[Symbol.metadata];
    expect(meta.__discriminator).toMatchSnapshot();
  });

  test("should stage __discriminator as { fieldName: 'type' } object shape", () => {
    const meta = (DiscriminatorOnType as any)[Symbol.metadata];
    expect(meta.__discriminator).toEqual({ fieldName: "type" });
  });

  test("should stage __discriminator on own metadata object only", () => {
    const meta = (DiscriminatorOnType as any)[Symbol.metadata];
    expect(Object.hasOwn(meta, "__discriminator")).toBe(true);
  });

  test("should not stage __discriminator on a class without the decorator", () => {
    class PlainClass {
      type!: string;
    }
    const meta = (PlainClass as any)[Symbol.metadata];
    expect(meta?.__discriminator).toBeUndefined();
  });
});
