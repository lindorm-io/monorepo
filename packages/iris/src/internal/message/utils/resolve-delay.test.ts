import type { MessageMetadata } from "../types/metadata";
import { resolveDelay } from "./resolve-delay";
import { describe, expect, it } from "vitest";

const makeMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    delay: null,
    ...overrides,
  }) as unknown as MessageMetadata;

describe("resolveDelay", () => {
  it("should return 0 when no delay is set", () => {
    const metadata = makeMetadata();
    expect(resolveDelay(undefined, metadata)).toBe(0);
  });

  it("should return metadata delay as fallback", () => {
    const metadata = makeMetadata({ delay: 3000 });
    expect(resolveDelay(undefined, metadata)).toBe(3000);
  });

  it("should return options delay when provided", () => {
    const metadata = makeMetadata();
    expect(resolveDelay({ delay: 5000 }, metadata)).toBe(5000);
  });

  it("should prefer options delay over metadata delay", () => {
    const metadata = makeMetadata({ delay: 3000 });
    expect(resolveDelay({ delay: 5000 }, metadata)).toBe(5000);
  });

  it("should fall back to metadata when options delay is undefined", () => {
    const metadata = makeMetadata({ delay: 3000 });
    expect(resolveDelay({}, metadata)).toBe(3000);
  });

  it("should return options delay of zero", () => {
    const metadata = makeMetadata({ delay: 3000 });
    expect(resolveDelay({ delay: 0 }, metadata)).toBe(0);
  });
});
