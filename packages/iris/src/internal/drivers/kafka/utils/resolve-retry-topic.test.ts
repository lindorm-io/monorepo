import { resolveRetryTopicName } from "./resolve-retry-topic.js";
import { describe, expect, it } from "vitest";

describe("resolveRetryTopicName", () => {
  it("suffixes the base topic with the group id", () => {
    expect(resolveRetryTopicName("iris.Orders", "iris.sub.Orders.q1")).toBe(
      "iris.Orders.retry.iris.sub.Orders.q1",
    );
  });

  it("keys the retry topic off the broadcast topic for a broadcast consumer", () => {
    expect(
      resolveRetryTopicName("iris.Orders.broadcast", "iris.worker.Orders.q1.bc.abc"),
    ).toBe("iris.Orders.broadcast.retry.iris.worker.Orders.q1.bc.abc");
  });

  it("produces distinct topics for distinct groups on the same base topic", () => {
    const a = resolveRetryTopicName("iris.Orders", "group-a");
    const b = resolveRetryTopicName("iris.Orders", "group-b");
    expect(a).not.toBe(b);
  });
});
