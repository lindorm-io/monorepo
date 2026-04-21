import { resolveStreamKey } from "./resolve-stream-key";
import { describe, expect, it } from "vitest";

describe("resolveStreamKey", () => {
  it("should build stream key from prefix and topic", () => {
    expect(resolveStreamKey("iris", "orders.created")).toMatchSnapshot();
  });

  it("should handle custom prefix", () => {
    expect(resolveStreamKey("myapp", "users.updated")).toMatchSnapshot();
  });

  it("should handle topic with special characters", () => {
    expect(resolveStreamKey("iris", "orders/created@v2")).toMatchSnapshot();
  });

  it("should handle empty prefix", () => {
    expect(resolveStreamKey("", "test-topic")).toMatchSnapshot();
  });
});
