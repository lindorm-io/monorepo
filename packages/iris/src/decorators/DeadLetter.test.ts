import { DeadLetter } from "./DeadLetter";
import { describe, expect, it } from "vitest";

describe("DeadLetter", () => {
  it("should stage dead letter metadata as true", () => {
    @DeadLetter()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.deadLetter).toBe(true);
  });
});
