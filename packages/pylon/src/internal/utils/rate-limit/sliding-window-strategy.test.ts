import { slidingWindowStrategy } from "./sliding-window-strategy";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("slidingWindowStrategy", () => {
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

  test("should allow when no timestamps exist", async () => {
    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      timestamps: [],
      expiresAt: new Date("2026-01-01T00:02:00.000Z"),
    });

    const result = await slidingWindowStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result).toMatchSnapshot();
  });

  test("should allow when timestamps within window are under max", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const recentTimestamps = [
      new Date(now.getTime() - 30000),
      new Date(now.getTime() - 20000),
      new Date(now.getTime() - 10000),
    ];

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      timestamps: recentTimestamps,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await slidingWindowStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    // 3 existing + 1 new = 4, remaining = 10 - 4 = 6
    expect(result.remaining).toBe(6);
    expect(result).toMatchSnapshot();
  });

  test("should deny when timestamps within window reach max", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const recentTimestamps = Array.from(
      { length: 10 },
      (_, i) => new Date(now.getTime() - (10 - i) * 1000),
    );

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      timestamps: recentTimestamps,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await slidingWindowStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result).toMatchSnapshot();
  });

  test("should filter out timestamps outside the window", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const timestamps = [
      new Date(now.getTime() - 120000), // outside window
      new Date(now.getTime() - 90000), // outside window
      new Date(now.getTime() - 30000), // inside window
      new Date(now.getTime() - 10000), // inside window
    ];

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      timestamps,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await slidingWindowStrategy(repository, "test-key", 60000, 10);

    expect(result.allowed).toBe(true);
    // Only 2 valid + 1 new = 3, remaining = 10 - 3 = 7
    expect(result.remaining).toBe(7);

    // The update should only contain valid timestamps + now
    const updatedEntity = mockUpdate.mock.calls[0][0];
    expect(updatedEntity.timestamps).toHaveLength(3);
  });

  test("should return correct remaining count", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const recentTimestamps = Array.from(
      { length: 7 },
      (_, i) => new Date(now.getTime() - (7 - i) * 1000),
    );

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      timestamps: recentTimestamps,
      expiresAt: new Date(now.getTime() + 120000),
    });

    const result = await slidingWindowStrategy(repository, "test-key", 60000, 10);

    // 7 existing + 1 new = 8, remaining = 10 - 8 = 2
    expect(result.remaining).toBe(2);
  });

  test("should add current timestamp to the list", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    mockFindOneOrSave.mockResolvedValue({
      id: "test-key",
      timestamps: [],
      expiresAt: new Date(now.getTime() + 120000),
    });

    await slidingWindowStrategy(repository, "test-key", 60000, 10);

    const updatedEntity = mockUpdate.mock.calls[0][0];
    expect(updatedEntity.timestamps).toContainEqual(now);
  });
});
