import { IdentifierField } from "./IdentifierField.js";
import { describe, expect, it } from "vitest";

describe("IdentifierField", () => {
  it("should stage identifier field metadata", () => {
    class TestMsg {
      @IdentifierField()
      id!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(1);

    const field = metadata.fields[0];
    expect(field.key).toBe("id");
    expect(field.decorator).toBe("IdentifierField");
    expect(field.type).toBe("uuid");
    expect(field.nullable).toBe(false);
    expect(field.optional).toBe(false);
    expect(typeof field.default).toBe("function");
    expect(field.default()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
