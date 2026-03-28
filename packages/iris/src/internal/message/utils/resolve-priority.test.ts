import type { MessageMetadata } from "../types/metadata";
import { resolvePriority } from "./resolve-priority";

const makeMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    priority: null,
    ...overrides,
  }) as unknown as MessageMetadata;

describe("resolvePriority", () => {
  it("should return 0 when no priority is set", () => {
    const metadata = makeMetadata();
    expect(resolvePriority(undefined, metadata)).toBe(0);
  });

  it("should return metadata priority as fallback", () => {
    const metadata = makeMetadata({ priority: 7 });
    expect(resolvePriority(undefined, metadata)).toBe(7);
  });

  it("should return options priority when provided", () => {
    const metadata = makeMetadata({ priority: 7 });
    expect(resolvePriority({ priority: 3 }, metadata)).toBe(3);
  });

  it("should prefer options priority over metadata priority", () => {
    const metadata = makeMetadata({ priority: 5 });
    expect(resolvePriority({ priority: 2 }, metadata)).toBe(2);
  });

  it("should fall back to metadata when options priority is undefined", () => {
    const metadata = makeMetadata({ priority: 5 });
    expect(resolvePriority({}, metadata)).toBe(5);
  });

  it("should return options priority of zero", () => {
    const metadata = makeMetadata({ priority: 5 });
    expect(resolvePriority({ priority: 0 }, metadata)).toBe(0);
  });
});
