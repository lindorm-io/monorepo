import { PersistentField } from "./PersistentField";
import { describe, expect, it } from "vitest";

describe("PersistentField", () => {
  it("should stage persistent field metadata", () => {
    class TestMsg {
      @PersistentField()
      persistent!: boolean;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toMatchSnapshot();
  });
});
