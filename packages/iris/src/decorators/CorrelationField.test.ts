import { CorrelationField } from "./CorrelationField.js";
import { describe, expect, it } from "vitest";

describe("CorrelationField", () => {
  it("should stage correlation field metadata", () => {
    class TestMsg {
      @CorrelationField()
      correlationId!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(1);

    const field = metadata.fields[0];
    expect(field.key).toBe("correlationId");
    expect(field.decorator).toBe("CorrelationField");
    expect(field.type).toBe("uuid");
    expect(field.nullable).toBe(false);
    expect(typeof field.default).toBe("function");
    expect(field.default()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
