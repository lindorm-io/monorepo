import { Encrypted } from "./Encrypted";
import { describe, expect, it } from "vitest";

describe("Encrypted", () => {
  it("should stage encrypted metadata with defaults", () => {
    @Encrypted()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.encrypted).toMatchSnapshot();
  });

  it("should stage encrypted metadata with predicate", () => {
    @Encrypted({ algorithm: "AES-256", purpose: "pii" } as any)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.encrypted).toMatchSnapshot();
  });
});
