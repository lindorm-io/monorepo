import type { MessageMetadata } from "../types/metadata";
import { resolveExpiry } from "./resolve-expiry";
import { describe, expect, it } from "vitest";

const makeMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    expiry: null,
    ...overrides,
  }) as unknown as MessageMetadata;

describe("resolveExpiry", () => {
  it("should return null when no expiry is set", () => {
    const metadata = makeMetadata();
    expect(resolveExpiry(undefined, metadata)).toBeNull();
  });

  it("should return metadata expiry as fallback", () => {
    const metadata = makeMetadata({ expiry: 30000 });
    expect(resolveExpiry(undefined, metadata)).toBe(30000);
  });

  it("should return options expiry when provided", () => {
    const metadata = makeMetadata();
    expect(resolveExpiry({ expiry: 5000 }, metadata)).toBe(5000);
  });

  it("should prefer options expiry over metadata expiry", () => {
    const metadata = makeMetadata({ expiry: 30000 });
    expect(resolveExpiry({ expiry: 5000 }, metadata)).toBe(5000);
  });

  it("should fall back to metadata when options expiry is undefined", () => {
    const metadata = makeMetadata({ expiry: 30000 });
    expect(resolveExpiry({}, metadata)).toBe(30000);
  });

  it("should return options expiry of zero", () => {
    const metadata = makeMetadata({ expiry: 30000 });
    expect(resolveExpiry({ expiry: 0 }, metadata)).toBe(0);
  });
});
