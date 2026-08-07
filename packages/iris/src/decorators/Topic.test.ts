import { Topic } from "./Topic.js";
import { describe, expect, it } from "vitest";

describe("Topic", () => {
  it("should stage topic metadata with callback", () => {
    const cb = (msg: any) => `orders.${msg.region}`;

    @Topic(cb)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.topic).toEqual({ type: "dynamic", callback: cb });
  });

  it("should produce correct topic from callback", () => {
    const cb = (msg: any) => `events.${msg.type}`;

    @Topic(cb)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.topic.callback({ type: "created" })).toBe("events.created");
  });

  // ⭐ A constant topic must be stageable as a CONSTANT, not as a callback that
  // happens to return one -- only the static form is resolvable without a
  // message instance, which is what lets consume() find the publish topic.
  it("should stage a string argument as a static topic", () => {
    @Topic("audit.request")
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.topic).toEqual({ type: "static", topic: "audit.request" });
  });
});
