import { Persistent } from "./Persistent";

describe("Persistent", () => {
  it("should stage persistent flag on metadata", () => {
    @Persistent()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.persistent).toBe(true);
  });
});
