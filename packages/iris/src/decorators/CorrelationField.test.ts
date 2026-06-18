import { CorrelationField } from "./CorrelationField.js";
import { describe, expect, it } from "vitest";

describe("CorrelationField", () => {
  it("should stage correlation field metadata as a pure marker", () => {
    class TestMsg {
      @CorrelationField()
      correlationId!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(1);

    const field = metadata.fields[0];
    expect(field.key).toBe("correlationId");
    expect(field.decorator).toBe("CorrelationField");
    expect(field.type).toBe("string");
    expect(field.nullable).toBe(false);
    expect(field.optional).toBe(false);
    expect(field.default).toBeNull();
  });

  it("should NOT stage a generated entry on its own", () => {
    class TestMsg {
      @CorrelationField()
      correlationId!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated ?? []).toHaveLength(0);
  });
});
