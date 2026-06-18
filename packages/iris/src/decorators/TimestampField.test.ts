import { TimestampField } from "./TimestampField.js";
import { describe, expect, it } from "vitest";

describe("TimestampField", () => {
  it("should stage timestamp field metadata", () => {
    class TestMsg {
      @TimestampField()
      createdAt!: Date;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(1);

    const field = metadata.fields[0];
    expect(field.key).toBe("createdAt");
    expect(field.decorator).toBe("TimestampField");
    expect(field.type).toBe("date");
    expect(field.nullable).toBe(false);
    expect(field.default).toBeNull();
  });

  it("should stage a generated 'date' entry so the timestamp auto-fills", () => {
    class TestMsg {
      @TimestampField()
      createdAt!: Date;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated).toHaveLength(1);

    const generated = metadata.generated[0];
    expect(generated.key).toBe("createdAt");
    expect(generated.strategy).toBe("date");
    expect(generated.generator).toBeNull();
  });
});
