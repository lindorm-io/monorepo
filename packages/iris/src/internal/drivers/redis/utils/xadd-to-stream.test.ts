import type { RedisClient } from "../types/redis-types";
import { xaddToStream } from "./xadd-to-stream";
import { describe, expect, it, vi } from "vitest";

const createMockConnection = (): RedisClient => ({
  xadd: vi.fn().mockResolvedValue("1-1"),
  xreadgroup: vi.fn(),
  xack: vi.fn(),
  xgroup: vi.fn(),
  del: vi.fn(),
  ping: vi.fn().mockResolvedValue("PONG"),
  duplicate: vi.fn(),
  disconnect: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
  on: vi.fn(),
});

describe("xaddToStream", () => {
  it("should call xadd without MAXLEN when maxStreamLength is null", async () => {
    const conn = createMockConnection();
    await xaddToStream(conn, "my-stream", ["field1", "value1"], null);

    expect(conn.xadd).toHaveBeenCalledWith("my-stream", "*", "field1", "value1");
  });

  it("should call xadd without MAXLEN when maxStreamLength is undefined", async () => {
    const conn = createMockConnection();
    await xaddToStream(conn, "my-stream", ["field1", "value1"]);

    expect(conn.xadd).toHaveBeenCalledWith("my-stream", "*", "field1", "value1");
  });

  it("should call xadd with MAXLEN when maxStreamLength is provided", async () => {
    const conn = createMockConnection();
    await xaddToStream(conn, "my-stream", ["field1", "value1"], 1000);

    expect(conn.xadd).toHaveBeenCalledWith(
      "my-stream",
      "MAXLEN",
      "~",
      1000,
      "*",
      "field1",
      "value1",
    );
  });

  it("should return the stream entry ID", async () => {
    const conn = createMockConnection();
    const result = await xaddToStream(conn, "my-stream", ["field1", "value1"]);
    expect(result).toBe("1-1");
  });

  it("should call xadd without MAXLEN when maxStreamLength is 0", async () => {
    const conn = createMockConnection();
    await xaddToStream(conn, "my-stream", ["field1", "value1"], 0);

    expect(conn.xadd).toHaveBeenCalledWith("my-stream", "*", "field1", "value1");
  });
});
