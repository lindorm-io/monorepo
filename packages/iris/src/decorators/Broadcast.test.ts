import { Broadcast } from "./Broadcast.js";
import { describe, expect, it } from "vitest";

describe("Broadcast", () => {
  it("should stage broadcast flag on metadata", () => {
    @Broadcast()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.broadcast).toBe(true);
  });
});
