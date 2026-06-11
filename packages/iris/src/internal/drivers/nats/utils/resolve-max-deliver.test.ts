import type { MessageMetadata } from "../../../message/types/metadata.js";
import { resolveMaxDeliver } from "./resolve-max-deliver.js";
import { describe, expect, it } from "vitest";

const baseMetadata = { retry: null } as unknown as MessageMetadata;

describe("resolveMaxDeliver", () => {
  it("should return 1 when the message has no @Retry metadata", () => {
    expect(resolveMaxDeliver(baseMetadata)).toBe(1);
  });

  it("should return maxRetries + 1 when @Retry is configured", () => {
    const metadata = {
      retry: {
        maxRetries: 3,
        strategy: "constant",
        delay: 50,
        delayMax: 1000,
        multiplier: 2,
        jitter: false,
      },
    } as unknown as MessageMetadata;

    expect(resolveMaxDeliver(metadata)).toBe(4);
  });

  it("should return 1 when maxRetries is 0 (single delivery, no server redelivery)", () => {
    const metadata = {
      retry: {
        maxRetries: 0,
        strategy: "constant",
        delay: 50,
        delayMax: 1000,
        multiplier: 2,
        jitter: false,
      },
    } as unknown as MessageMetadata;

    expect(resolveMaxDeliver(metadata)).toBe(1);
  });
});
