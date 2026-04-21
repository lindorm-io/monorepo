import { Topic } from "./Topic";
import { describe, expect, it } from "vitest";

describe("Topic", () => {
  it("should stage topic metadata with callback", () => {
    const cb = (msg: any) => `orders.${msg.region}`;

    @Topic(cb)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.topic.callback).toBe(cb);
  });

  it("should produce correct topic from callback", () => {
    const cb = (msg: any) => `events.${msg.type}`;

    @Topic(cb)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.topic.callback({ type: "created" })).toBe("events.created");
  });
});
