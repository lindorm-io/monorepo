import type { RedisClient } from "../types/redis-types";
import { xaddToStream } from "./xadd-to-stream";

const createMockConnection = (): RedisClient => ({
  xadd: jest.fn().mockResolvedValue("1-1"),
  xreadgroup: jest.fn(),
  xack: jest.fn(),
  xgroup: jest.fn(),
  del: jest.fn(),
  ping: jest.fn().mockResolvedValue("PONG"),
  duplicate: jest.fn(),
  disconnect: jest.fn(),
  quit: jest.fn().mockResolvedValue("OK"),
  on: jest.fn(),
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
