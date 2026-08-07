import type { MessageMetadata } from "../types/metadata.js";
import { resolveTopic } from "./resolve-topic.js";
import { describe, expect, it } from "vitest";

describe("resolveTopic", () => {
  it("should return the topic from the callback when metadata.topic is dynamic", () => {
    const message = { type: "order.created", orderId: "123" };
    const metadata = {
      namespace: null,
      topic: { type: "dynamic", callback: (msg: any) => `events.${msg.type}` },
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
      topic: { type: "dynamic", callback: (msg: any) => `events.${msg.type}` },
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

  it("should return a static topic verbatim when no namespace is set", () => {
    const message = { orderId: "123" };
    const metadata = {
      namespace: null,
      topic: { type: "static", topic: "audit.request" },
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });

  // ⭐ The prefix is applied ONCE. A static topic must not re-spell the
  // namespace it already carries -- that is what produced pylon's
  // `pylon.pylon.audit.request`.
  it("should prefix a static topic with the namespace exactly once", () => {
    const message = { orderId: "123" };
    const metadata = {
      namespace: "pylon",
      topic: { type: "static", topic: "audit.request" },
      message: { name: "RequestAudit" },
    } as unknown as MessageMetadata;

    expect(resolveTopic(message, metadata)).toMatchSnapshot();
  });
});
