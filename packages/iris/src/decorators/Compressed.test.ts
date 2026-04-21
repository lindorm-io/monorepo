import { Compressed } from "./Compressed.js";
import { describe, expect, it } from "vitest";

describe("Compressed", () => {
  it("should stage compressed metadata with default gzip", () => {
    @Compressed()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.compressed).toMatchSnapshot();
  });

  it("should stage compressed metadata with brotli", () => {
    @Compressed("brotli")
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.compressed).toMatchSnapshot();
  });

  it("should stage compressed metadata with deflate", () => {
    @Compressed("deflate")
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.compressed).toMatchSnapshot();
  });
});
