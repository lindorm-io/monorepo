import { TimestampField } from "./TimestampField";

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
    expect(typeof field.default).toBe("function");
    expect(field.default()).toBeInstanceOf(Date);
  });
});
