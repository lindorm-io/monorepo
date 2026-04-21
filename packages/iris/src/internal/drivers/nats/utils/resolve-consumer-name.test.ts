import { resolveConsumerName } from "./resolve-consumer-name";
import { describe, expect, it } from "vitest";

describe("resolveConsumerName", () => {
  describe("subscribe", () => {
    it("should return named consumer when queue is provided", () => {
      expect(
        resolveConsumerName({
          prefix: "iris",
          topic: "orders.created",
          queue: "order-service",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });

    it("should return topic-based consumer when no queue", () => {
      expect(
        resolveConsumerName({
          prefix: "iris",
          topic: "orders.created",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("worker", () => {
    it("should use queue name when provided", () => {
      expect(
        resolveConsumerName({
          prefix: "iris",
          topic: "jobs.process",
          queue: "worker-pool",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });

    it("should fall back to topic when no queue", () => {
      expect(
        resolveConsumerName({
          prefix: "iris",
          topic: "jobs.process",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("rpc", () => {
    it("should use queue name when provided", () => {
      expect(
        resolveConsumerName({
          prefix: "iris",
          topic: "users.get",
          queue: "user-service",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });

    it("should fall back to topic when no queue", () => {
      expect(
        resolveConsumerName({
          prefix: "iris",
          topic: "users.get",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });
  });
});
