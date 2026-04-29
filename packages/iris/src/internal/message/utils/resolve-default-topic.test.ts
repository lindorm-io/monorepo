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
});
