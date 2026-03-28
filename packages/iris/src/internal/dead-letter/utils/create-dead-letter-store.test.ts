import type { IDeadLetterStore } from "../../../interfaces/IrisDeadLetterStore";
import { MemoryDeadLetterStore } from "../MemoryDeadLetterStore";
import { RedisDeadLetterStore } from "../RedisDeadLetterStore";
import { createDeadLetterStore } from "./create-dead-letter-store";

const mockPing = jest.fn().mockResolvedValue("PONG");

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    ping: mockPing,
    quit: jest.fn(),
  })),
}));

describe("createDeadLetterStore", () => {
  beforeEach(() => {
    mockPing.mockClear();
    mockPing.mockResolvedValue("PONG");
  });

  it("should return MemoryDeadLetterStore when config is undefined", async () => {
    const store = await createDeadLetterStore();
    expect(store).toBeInstanceOf(MemoryDeadLetterStore);
  });

  it("should return MemoryDeadLetterStore when type is memory", async () => {
    const store = await createDeadLetterStore({ type: "memory" });
    expect(store).toBeInstanceOf(MemoryDeadLetterStore);
  });

  it("should return the custom store as-is", async () => {
    const custom: IDeadLetterStore = {
      add: jest.fn(),
      list: jest.fn(),
      get: jest.fn(),
      remove: jest.fn(),
      purge: jest.fn(),
      count: jest.fn(),
      close: jest.fn(),
    };

    const store = await createDeadLetterStore({ type: "custom", store: custom });
    expect(store).toBe(custom);
  });

  it("should return RedisDeadLetterStore for redis type", async () => {
    const store = await createDeadLetterStore({
      type: "redis",
      url: "redis://localhost",
    });
    expect(store).toBeInstanceOf(RedisDeadLetterStore);
  });

  it("should verify redis connectivity with ping", async () => {
    await createDeadLetterStore({ type: "redis", url: "redis://localhost" });
    expect(mockPing).toHaveBeenCalled();
  });

  it("should throw a descriptive error when ping fails", async () => {
    mockPing.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      createDeadLetterStore({ type: "redis", url: "redis://localhost:9999" }),
    ).rejects.toThrow(
      "Failed to connect dead letter store to Redis at redis://localhost:9999",
    );
  });
});
