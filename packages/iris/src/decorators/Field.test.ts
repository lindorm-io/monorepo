import { Field } from "./Field.js";
import { describe, expect, it } from "vitest";

describe("Field", () => {
  it("should stage field with explicit type", () => {
    class TestMsg {
      @Field("string")
      name!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toMatchSnapshot();
  });

  it("should accumulate multiple fields", () => {
    class TestMsg {
      @Field("string")
      first!: string;

      @Field("integer")
      second!: number;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(2);
    expect(metadata.fields).toMatchSnapshot();
  });
});
