import { Enum } from "./Enum.js";
import { describe, expect, it } from "vitest";

describe("Enum", () => {
  it("should stage field modifier with enum values", () => {
    const StatusEnum = { Active: "active", Inactive: "inactive" } as const;

    class TestMsg {
      @Enum(StatusEnum)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      status!: string;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0]).toMatchSnapshot();
  });

  it("should handle numeric enum values", () => {
    const PriorityEnum = { Low: 1, Medium: 2, High: 3 } as const;

    class TestMsg {
      @Enum(PriorityEnum)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      priority!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers[0].enum).toEqual(PriorityEnum);
  });
});
