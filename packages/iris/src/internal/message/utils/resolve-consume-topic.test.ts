import type { ILogger } from "@lindorm/logger";
import type { MessageMetadata } from "../types/metadata.js";
import { resolveConsumeTopic } from "./resolve-consume-topic.js";
import { describe, expect, it, vi } from "vitest";

describe("resolveConsumeTopic", () => {
  it("should return the namespaced message name when namespace is set", () => {
    const metadata = {
      namespace: "ns",
      message: { name: "OrderCreated" },
      topic: null,
    } as unknown as MessageMetadata;

    expect(resolveConsumeTopic(metadata)).toMatchSnapshot();
  });

  it("should return the bare message name when namespace is null", () => {
    const metadata = {
      namespace: null,
      message: { name: "OrderCreated" },
      topic: null,
    } as unknown as MessageMetadata;

    expect(resolveConsumeTopic(metadata)).toMatchSnapshot();
  });

  it("should warn and fall back to the message name for a dynamic @Topic callback", () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as ILogger;

    const metadata = {
      namespace: "ns",
      message: { name: "OrderCreated" },
      topic: { type: "dynamic", callback: () => "dynamic" },
    } as unknown as MessageMetadata;

    expect(resolveConsumeTopic(metadata, logger)).toMatchSnapshot();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("should honor the explicit queue for a dynamic @Topic callback without warning", () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as ILogger;

    const metadata = {
      namespace: "ns",
      message: { name: "OrderCreated" },
      topic: { type: "dynamic", callback: () => "dynamic" },
    } as unknown as MessageMetadata;

    expect(
      resolveConsumeTopic(metadata, logger, "queue.aggregate.ns.order.create"),
    ).toMatchSnapshot();
    expect(warn).not.toHaveBeenCalled();
  });

  it("should ignore an explicit queue for an undecorated message and use the namespaced name", () => {
    const metadata = {
      namespace: "ns",
      message: { name: "OrderCreated" },
      topic: null,
    } as unknown as MessageMetadata;

    expect(
      resolveConsumeTopic(metadata, undefined, "some-explicit-queue"),
    ).toMatchSnapshot();
  });

  // ⭐ The whole point of the static form: the queue stays the consumer-group
  // identity and the TOPIC comes from the decorator, so it equals what
  // `resolveTopic` publishes to. Deriving the topic from the queue string is
  // exactly the trap this removes.
  it("should ignore the queue for a static @Topic and resolve the namespaced topic", () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as ILogger;

    const metadata = {
      namespace: "pylon",
      message: { name: "RequestAudit" },
      topic: { type: "static", topic: "audit.request" },
    } as unknown as MessageMetadata;

    expect(
      resolveConsumeTopic(metadata, logger, "pylon.audit.request.persist"),
    ).toMatchSnapshot();
    expect(warn).not.toHaveBeenCalled();
  });

  it("should resolve a static @Topic without a queue and without warning", () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as ILogger;

    const metadata = {
      namespace: null,
      message: { name: "RequestAudit" },
      topic: { type: "static", topic: "audit.request" },
    } as unknown as MessageMetadata;

    expect(resolveConsumeTopic(metadata, logger)).toMatchSnapshot();
    expect(warn).not.toHaveBeenCalled();
  });
});
