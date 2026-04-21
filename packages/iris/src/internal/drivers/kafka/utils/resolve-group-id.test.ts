import { resolveGroupId } from "./resolve-group-id.js";
import { describe, expect, it } from "vitest";

describe("resolveGroupId", () => {
  describe("subscribe", () => {
    it("should include topic when provided", () => {
      expect(
        resolveGroupId({
          prefix: "iris",
          topic: "orders.created",
          queue: "order-service",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });

    it("should omit topic when not provided", () => {
      expect(
        resolveGroupId({
          prefix: "iris",
          queue: "order-service",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("worker", () => {
    it("should use queue name", () => {
      expect(
        resolveGroupId({
          prefix: "iris",
          queue: "worker-pool",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });

    it("should ignore topic for worker type", () => {
      expect(
        resolveGroupId({
          prefix: "iris",
          topic: "jobs.process",
          queue: "worker-pool",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("rpc", () => {
    it("should use queue name", () => {
      expect(
        resolveGroupId({
          prefix: "iris",
          queue: "user-service",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });

    it("should ignore topic for rpc type", () => {
      expect(
        resolveGroupId({
          prefix: "iris",
          topic: "users.get",
          queue: "user-service",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });
  });

  it("should handle custom prefix", () => {
    expect(
      resolveGroupId({
        prefix: "myapp",
        topic: "events",
        queue: "handler",
        type: "subscribe",
      }),
    ).toMatchSnapshot();
  });
});
