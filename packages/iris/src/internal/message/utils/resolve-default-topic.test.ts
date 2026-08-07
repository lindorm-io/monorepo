import type { MessageMetadata } from "../types/metadata.js";
import { resolveDefaultTopic } from "./resolve-default-topic.js";
import { describe, expect, it } from "vitest";

describe("resolveDefaultTopic", () => {
  it("should prefix the message name with namespace when set", () => {
    const metadata = {
      namespace: "orders",
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveDefaultTopic(metadata)).toMatchSnapshot();
  });

  it("should return the message name when namespace is null", () => {
    const metadata = {
      namespace: null,
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveDefaultTopic(metadata)).toMatchSnapshot();
  });

  it("should treat empty string namespace as no namespace", () => {
    const metadata = {
      namespace: "",
      message: { name: "OrderCreated" },
    } as unknown as MessageMetadata;

    expect(resolveDefaultTopic(metadata)).toMatchSnapshot();
  });

  it("should prefer a static @Topic over the message name", () => {
    const metadata = {
      namespace: "pylon",
      message: { name: "RequestAudit" },
      topic: { type: "static", topic: "audit.request" },
    } as unknown as MessageMetadata;

    expect(resolveDefaultTopic(metadata)).toMatchSnapshot();
  });

  // A dynamic callback is not statically resolvable, so the message name is
  // the only honest answer here -- the callers that need better pass a queue
  // through `resolveConsumeTopic`.
  it("should fall back to the message name for a dynamic @Topic", () => {
    const metadata = {
      namespace: "pylon",
      message: { name: "RequestAudit" },
      topic: { type: "dynamic", callback: () => "audit.request" },
    } as unknown as MessageMetadata;

    expect(resolveDefaultTopic(metadata)).toMatchSnapshot();
  });
});
