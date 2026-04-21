import { resolveQueueName } from "./resolve-queue-name";
import { describe, expect, it } from "vitest";

describe("resolveQueueName", () => {
  describe("subscribe", () => {
    it("should return named queue when queue is provided", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "orders.created",
          queue: "order-service",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });

    it("should return null for broadcast (no queue)", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "orders.created",
          type: "subscribe",
        }),
      ).toBeNull();
    });

    it("should sanitize topic in queue name", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "orders/created@v2",
          queue: "svc",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("worker", () => {
    it("should use queue name when provided", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "jobs.process",
          queue: "worker-pool",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });

    it("should fall back to sanitized topic when no queue", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "jobs.process",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("rpc", () => {
    it("should use queue name when provided", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "users.get",
          queue: "user-service",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });

    it("should fall back to sanitized topic when no queue", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "users.get",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("delay", () => {
    it("should build delay queue name from topic", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "orders.retry",
          type: "delay",
        }),
      ).toMatchSnapshot();
    });

    it("should sanitize topic in delay queue name", () => {
      expect(
        resolveQueueName({
          exchange: "iris",
          topic: "orders/retry@v2",
          type: "delay",
        }),
      ).toMatchSnapshot();
    });
  });
});
