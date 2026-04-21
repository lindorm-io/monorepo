import { ensureNatsStream } from "./ensure-nats-stream";
import { describe, expect, it, vi } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockJsm = (overrides?: {
  infoResult?: any;
  infoError?: Error;
  addResult?: any;
}) => ({
  streams: {
    info: overrides?.infoError
      ? vi.fn().mockRejectedValue(overrides.infoError)
      : vi
          .fn()
          .mockResolvedValue(overrides?.infoResult ?? { config: { name: "IRIS_TEST" } }),
    add: vi.fn().mockResolvedValue(overrides?.addResult ?? {}),
    purge: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  consumers: { add: vi.fn(), delete: vi.fn().mockResolvedValue(true) },
});

describe("ensureNatsStream", () => {
  it("should not create stream if it already exists", async () => {
    const jsm = createMockJsm();
    const logger = createMockLogger();

    await ensureNatsStream({
      jsm,
      streamName: "IRIS_TEST",
      subjects: ["test.>"],
      logger: logger as any,
    });

    expect(jsm.streams.info).toHaveBeenCalledWith("IRIS_TEST");
    expect(jsm.streams.add).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith("Stream already exists", {
      streamName: "IRIS_TEST",
    });
  });

  it("should create stream when stream not found", async () => {
    const jsm = createMockJsm({ infoError: new Error("stream not found") });
    const logger = createMockLogger();

    await ensureNatsStream({
      jsm,
      streamName: "IRIS_TEST",
      subjects: ["test.>"],
      logger: logger as any,
    });

    expect(jsm.streams.add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "IRIS_TEST",
        subjects: ["test.>"],
        retention: "limits",
        storage: "file",
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith("Stream created", {
      streamName: "IRIS_TEST",
      subjects: ["test.>"],
    });
  });

  it("should create stream when error code is 404", async () => {
    const err = new Error("not found") as any;
    err.code = "404";
    const jsm = createMockJsm({ infoError: err });
    const logger = createMockLogger();

    await ensureNatsStream({
      jsm,
      streamName: "IRIS_TEST",
      subjects: ["test.>"],
      logger: logger as any,
    });

    expect(jsm.streams.add).toHaveBeenCalled();
  });

  it("should rethrow unexpected errors", async () => {
    const jsm = createMockJsm({ infoError: new Error("connection timeout") });
    const logger = createMockLogger();

    await expect(
      ensureNatsStream({
        jsm,
        streamName: "IRIS_TEST",
        subjects: ["test.>"],
        logger: logger as any,
      }),
    ).rejects.toThrow("connection timeout");
  });

  it("should pass full stream configuration to add", async () => {
    const jsm = createMockJsm({ infoError: new Error("stream not found") });
    const logger = createMockLogger();

    await ensureNatsStream({
      jsm,
      streamName: "IRIS_MYAPP",
      subjects: ["myapp.>"],
      logger: logger as any,
    });

    expect(jsm.streams.add).toHaveBeenCalledWith({
      name: "IRIS_MYAPP",
      subjects: ["myapp.>"],
      retention: "limits",
      storage: "file",
      max_consumers: -1,
      max_msgs: -1,
      max_bytes: -1,
      max_age: 604_800_000_000_000,
      discard: "old",
      num_replicas: 1,
    });
  });
});
