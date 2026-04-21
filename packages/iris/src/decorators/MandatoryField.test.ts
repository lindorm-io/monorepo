import { MandatoryField } from "./MandatoryField.js";
import { describe, expect, it } from "vitest";

describe("MandatoryField", () => {
  it("should stage mandatory field metadata", () => {
    class TestMsg {
      @MandatoryField()
      mandatory!: boolean;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toMatchSnapshot();
  });
});
