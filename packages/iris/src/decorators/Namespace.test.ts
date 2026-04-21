import { IrisMetadataError } from "../errors";
import { Namespace } from "./Namespace";
import { describe, expect, it } from "vitest";

describe("Namespace", () => {
  it("should stage namespace metadata", () => {
    @Namespace("orders")
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.namespace).toBe("orders");
  });

  it("should reject empty string as namespace", () => {
    expect(() => {
      @Namespace("")
      class TestMsg {}
    }).toThrow(IrisMetadataError);
  });

  it("should overwrite when applied multiple times (last wins)", () => {
    @Namespace("first")
    @Namespace("second")
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    // TC39 decorators apply bottom-to-top, so "first" runs last
    expect(meta.namespace).toBe("first");
  });
});
