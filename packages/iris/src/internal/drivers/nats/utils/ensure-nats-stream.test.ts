import { ensureNatsStream } from "./ensure-nats-stream";

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createMockJsm = (overrides?: {
  infoResult?: any;
  infoError?: Error;
  addResult?: any;
}) => ({
  streams: {
    info: overrides?.infoError
      ? jest.fn().mockRejectedValue(overrides.infoError)
      : jest
          .fn()
          .mockResolvedValue(overrides?.infoResult ?? { config: { name: "IRIS_TEST" } }),
    add: jest.fn().mockResolvedValue(overrides?.addResult ?? {}),
    purge: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  consumers: { add: jest.fn(), delete: jest.fn().mockResolvedValue(true) },
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
