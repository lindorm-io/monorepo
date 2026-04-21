import type { MessageMetadata } from "../types/metadata";
import { resolveTopic } from "./resolve-topic";
import { describe, expect, it } from "vitest";

describe("resolveTopic", () => {
  it("should return the topic from the callback when metadata.topic is set", () => {
    const message = { type: "order.created", orderId: "123" };
    const metadata = {
      namespace: null,
      topic: { callback: (msg: any) => `events.${msg.type}` },
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });

  it("should return the message name when metadata.topic is null", () => {
    const message = { orderId: "123" };
    const metadata = {
      namespace: null,
      topic: null,
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });

  it("should prefix with namespace when namespace is set and no topic callback", () => {
    const message = { orderId: "123" };
    const metadata = {
      namespace: "orders",
      topic: null,
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });

  it("should prefix with namespace when namespace is set and topic callback is used", () => {
    const message = { type: "order.created", orderId: "123" };
    const metadata = {
      namespace: "orders",
      topic: { callback: (msg: any) => `events.${msg.type}` },
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });

  it("should treat empty string namespace as no namespace", () => {
    const message = { orderId: "123" };
    const metadata = {
      namespace: "",
      topic: null,
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });
});
