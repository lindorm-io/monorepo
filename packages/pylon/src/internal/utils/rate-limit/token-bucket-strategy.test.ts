import { tokenBucketStrategy } from "./token-bucket-strategy";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("tokenBucketStrategy", () => {
  let mockFindOneOrSave: Mock;
  let mockUpdate: Mock;
  let repository: any;

  beforeEach(() => {
    mockFindOneOrSave = vi.fn();
    mockUpdate = vi.fn();
    repository = {
      findOneOrSave: mockFindOneOrSave,
      update: mockUpdate,
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should create new bucket with max tokens and allow", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      tokens: 10,
      lastRefill: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await tokenBucketStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    // 10 tokens, elapsed=0 so no refill, consume 1 => 9 remaining
    expect(result.remaining).toBe(9);
    expect(result).toMatchSnapshot();
  });

  test("should consume a token and allow", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      tokens: 5,
      lastRefill: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await tokenBucketStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);

    const updatedEntity = mockUpdate.mock.calls[0][0];
    expect(updatedEntity.tokens).toBe(4);
  });

  test("should deny when no tokens remain", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      tokens: 0,
      lastRefill: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await tokenBucketStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result).toMatchSnapshot();
  });

  test("should refill tokens based on elapsed time", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    // Last refill was 30 seconds ago, had 0 tokens
    // refillRate = 10 / 60000 = 1/6000 tokens per ms
    // tokensToAdd = floor((1/6000) * 30000) = floor(5) = 5
    const lastRefill = new Date(now.getTime() - 30000);

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      tokens: 0,
      lastRefill,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await tokenBucketStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    // 0 + 5 refilled = 5, consume 1 => 4 remaining
    expect(result.remaining).toBe(4);
  });

  test("should cap tokens at max (no overflow)", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    // Last refill was 120 seconds ago, had 8 tokens
    // tokensToAdd = floor((10/60000) * 120000) = floor(20) = 20
    // currentTokens = min(10, 8 + 20) = 10
    const lastRefill = new Date(now.getTime() - 120000);

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      tokens: 8,
      lastRefill,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await tokenBucketStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    // Capped at 10, consume 1 => 9 remaining
    expect(result.remaining).toBe(9);

    const updatedEntity = mockUpdate.mock.calls[0][0];
    expect(updatedEntity.tokens).toBe(9);
  });

  test("should return correct remaining count", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      tokens: 3,
      lastRefill: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await tokenBucketStrategy(repository, "test-key", 60000, 10);

    // 3 tokens, consume 1 => 2 remaining
    expect(result.remaining).toBe(2);
  });
});
