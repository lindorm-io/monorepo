import { resolveTopicName } from "./resolve-topic-name.js";
import { describe, expect, it } from "vitest";

describe("resolveTopicName", () => {
  it("should build topic name from prefix and topic", () => {
    expect(resolveTopicName("iris", "orders.created")).toMatchSnapshot();
  });

  it("should handle custom prefix", () => {
    expect(resolveTopicName("myapp", "users.updated")).toMatchSnapshot();
  });

  it("should handle topic with special characters", () => {
    expect(resolveTopicName("iris", "orders-created-v2")).toMatchSnapshot();
  });

  it("should handle empty prefix", () => {
    expect(resolveTopicName("", "test-topic")).toMatchSnapshot();
  });
});
