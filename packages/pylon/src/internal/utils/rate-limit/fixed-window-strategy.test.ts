import { fixedWindowStrategy } from "./fixed-window-strategy";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("fixedWindowStrategy", () => {
  let mockFindOneOrSave: Mock;
  let mockUpdate: Mock;
  let mockIncrement: Mock;
  let repository: any;

  beforeEach(() => {
    mockFindOneOrSave = vi.fn();
    mockUpdate = vi.fn();
    mockIncrement = vi.fn();
    repository = {
      findOneOrSave: mockFindOneOrSave,
      update: mockUpdate,
      increment: mockIncrement,
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should create new counter and allow when no existing record", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      count: 0,
      windowStart: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await fixedWindowStrategy(repository, "test-key", 60000, 10);

    expect(mockFindOneOrSave).toHaveBeenCalledWith(
      { id: "test-key" },
      expect.objectContaining({ id: "test-key", count: 0 }),
    );
    expect(mockIncrement).toHaveBeenCalledWith({ id: "test-key" }, "count", 1);
    expect(result).toMatchSnapshot();
  });

  test("should increment and allow when under max", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      count: 5,
      windowStart: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await fixedWindowStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    expect(result).toMatchSnapshot();
  });

  test("should deny when count reaches max", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      count: 10,
      windowStart: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await fixedWindowStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result).toMatchSnapshot();
  });

  test("should reset window when window has expired", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const pastWindowStart = new Date(now.getTime() - 120000);

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      count: 8,
      windowStart: pastWindowStart,
      expiresAt: new Date(pastWindowStart.getTime() + 120000),
    });

    const result = await fixedWindowStrategy(repository, "test-key", 60000, 10);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, windowStart: now }),
    );
    expect(mockIncrement).not.toHaveBeenCalled();
    expect(result.allowed).toBe(true);
    expect(result).toMatchSnapshot();
  });

  test("should return correct remaining count", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      count: 3,
      windowStart: now,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await fixedWindowStrategy(repository, "test-key", 60000, 10);

    // count is 3, after increment newCount is 4, remaining = 10 - 4 = 6
    expect(result.remaining).toBe(6);
  });

  test("should return correct resetAt timestamp", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const windowStart = new Date(now.getTime() - 20000);

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      count: 2,
      windowStart,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await fixedWindowStrategy(repository, "test-key", 60000, 10);

    // resetAt = windowStart + windowMs = (now - 20000) + 60000 = now + 40000
    expect(result.resetAt).toEqual(new Date(windowStart.getTime() + 60000));
  });
});
