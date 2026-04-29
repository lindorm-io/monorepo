import { resolveGroupName } from "./resolve-group-name.js";
import { describe, expect, it } from "vitest";

describe("resolveGroupName", () => {
  describe("subscribe", () => {
    it("should return named queue when queue is provided", () => {
      expect(
        resolveGroupName({
          prefix: "iris",
          topic: "orders.created",
          queue: "order-service",
          type: "subscribe",
        }),
      ).toMatchSnapshot();
    });

    it("should return sub group when no queue is provided", () => {
      expect(
        resolveGroupName({
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
        resolveGroupName({
          prefix: "iris",
          topic: "jobs.process",
          queue: "worker-pool",
          type: "worker",
        }),
      ).toMatchSnapshot();
    });

    it("should fall back to topic when no queue", () => {
      expect(
        resolveGroupName({
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
        resolveGroupName({
          prefix: "iris",
          topic: "users.get",
          queue: "user-service",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });

    it("should fall back to topic when no queue", () => {
      expect(
        resolveGroupName({
          prefix: "iris",
          topic: "users.get",
          type: "rpc",
        }),
      ).toMatchSnapshot();
    });
  });
});
