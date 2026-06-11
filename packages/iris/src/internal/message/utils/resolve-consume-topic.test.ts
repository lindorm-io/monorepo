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

  it("should warn and fall back to the static topic for a dynamic @Topic callback", () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as ILogger;

    const metadata = {
      namespace: "ns",
      message: { name: "OrderCreated" },
      topic: { callback: () => "dynamic" },
    } as unknown as MessageMetadata;

    expect(resolveConsumeTopic(metadata, logger)).toMatchSnapshot();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
