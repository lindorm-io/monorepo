import type { IDelayStore } from "../../../interfaces/IrisDelayStore";
import { MemoryDelayStore } from "../MemoryDelayStore";
import { RedisDelayStore } from "../RedisDelayStore";
import { createDelayStore } from "./create-delay-store";

const mockPing = jest.fn().mockResolvedValue("PONG");

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    defineCommand: jest.fn(),
    ping: mockPing,
    quit: jest.fn(),
  })),
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
      schedule: jest.fn(),
      poll: jest.fn(),
      cancel: jest.fn(),
      size: jest.fn(),
      clear: jest.fn(),
      close: jest.fn(),
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
