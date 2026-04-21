import type { IDelayStore } from "../../../interfaces/IrisDelayStore";
import { MemoryDelayStore } from "../MemoryDelayStore";
import { RedisDelayStore } from "../RedisDelayStore";
import { createDelayStore } from "./create-delay-store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPing = vi.fn().mockResolvedValue("PONG");

vi.mock("ioredis", async () => ({
  Redis: vi.fn(function () {
    return {
      defineCommand: vi.fn(),
      ping: mockPing,
      quit: vi.fn(),
    };
  }),
}));

describe("createDelayStore", () => {
  beforeEach(() => {
    mockPing.mockClear();
    mockPing.mockResolvedValue("PONG");
  });

  it("should return MemoryDelayStore when config is undefined", async () => {
    const store = await createDelayStore();
    expect(store).toBeInstanceOf(MemoryDelayStore);
  });

  it("should return MemoryDelayStore when type is memory", async () => {
    const store = await createDelayStore({ type: "memory" });
    expect(store).toBeInstanceOf(MemoryDelayStore);
  });

  it("should return the custom store as-is", async () => {
    const custom: IDelayStore = {
      schedule: vi.fn(),
      poll: vi.fn(),
      cancel: vi.fn(),
      size: vi.fn(),
      clear: vi.fn(),
      close: vi.fn(),
    };

    const store = await createDelayStore({ type: "custom", store: custom });
    expect(store).toBe(custom);
  });

  it("should return RedisDelayStore for redis type", async () => {
    const store = await createDelayStore({ type: "redis", url: "redis://localhost" });
    expect(store).toBeInstanceOf(RedisDelayStore);
  });

  it("should verify redis connectivity with ping", async () => {
    await createDelayStore({ type: "redis", url: "redis://localhost" });
    expect(mockPing).toHaveBeenCalled();
  });

  it("should throw a descriptive error when ping fails", async () => {
    mockPing.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      createDelayStore({ type: "redis", url: "redis://localhost:9999" }),
    ).rejects.toThrow("Failed to connect delay store to Redis at redis://localhost:9999");
  });
});
