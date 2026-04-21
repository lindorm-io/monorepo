import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types.js";
import { RedisStreamPipeline } from "./RedisStreamPipeline.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
let mockCreateConsumerLoopResult: Partial<RedisConsumerLoop>;
const mockCreateConsumerLoop = vi
  .fn()
  .mockImplementation(async () => mockCreateConsumerLoopResult);
vi.mock("../utils/create-consumer-loop.js", async () => ({
  createConsumerLoop: (...args: Array<unknown>) => mockCreateConsumerLoop(...args),
}));

vi.mock("../utils/serialize-stream-fields.js", () => ({
  serializeStreamFields: vi
    .fn()
    .mockReturnValue(["payload", "dGVzdA==", "topic", "test"]),
}));

// --- Test messages ---

@Message({ name: "TckRedisPlIn" })
class TckRedisPlIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckRedisPlOut" })
class TckRedisPlOut implements IMessage {
  @Field("integer") result!: number;
}

// --- Helpers ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockState = (): RedisSharedState => ({
  publishConnection: {
    xadd: vi.fn().mockResolvedValue("1-1"),
    duplicate: vi.fn().mockReturnValue({
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }),
    disconnect: vi.fn(),
    xgroup: vi.fn().mockResolvedValue("OK"),
    xreadgroup: vi.fn(),
    xack: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  } as any,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:test:1:abcd1234",
  consumerLoops: [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 5000,
  maxStreamLength: null,
});

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockCreateConsumerLoop.mockClear();
  mockCreateConsumerLoopResult = {
    consumerTag: "pl-ctag",
    groupName: "iris.pipeline.test",
    streamKey: "iris:TckRedisPlIn",
    callback: vi.fn(),
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    connection: { disconnect: vi.fn() } as any,
  };
});

describe("RedisStreamPipeline", () => {
  it("should throw when no inputClass provided", async () => {
    const state = createMockState();
    const pipeline = new RedisStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      outputClass: TckRedisPlOut as any,
    });

    await expect(pipeline.start()).rejects.toThrow(
      "Stream pipeline requires an input class",
    );
  });

  it("should start successfully", async () => {
    const state = createMockState();
    const pipeline = new RedisStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckRedisPlIn as any,
      outputClass: TckRedisPlOut as any,
    });

    await pipeline.start();

    expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);
    expect(pipeline.isRunning()).toBe(true);
  });

  it("should stop and clean up loop", async () => {
    const ac = new AbortController();
    const dc = vi.fn().mockResolvedValue(undefined);
    mockCreateConsumerLoopResult = {
      consumerTag: "pl-ctag-stop",
      groupName: "iris.pipeline.test",
      streamKey: "iris:TckRedisPlIn",
      callback: vi.fn(),
      abortController: ac,
      loopPromise: Promise.resolve(),
      connection: { disconnect: dc } as any,
    };

    const state = createMockState();
    const pipeline = new RedisStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckRedisPlIn as any,
      outputClass: TckRedisPlOut as any,
    });

    await pipeline.start();

    await pipeline.stop();

    expect(ac.signal.aborted).toBe(true);
    expect(pipeline.isRunning()).toBe(false);
  });

  it("should pause and resume", async () => {
    const ac1 = new AbortController();
    const dc1 = vi.fn().mockResolvedValue(undefined);
    mockCreateConsumerLoopResult = {
      consumerTag: "pl-ctag-pause",
      groupName: "iris.pipeline.test",
      streamKey: "iris:TckRedisPlIn",
      callback: vi.fn(),
      abortController: ac1,
      loopPromise: Promise.resolve(),
      connection: { disconnect: dc1 } as any,
    };

    const state = createMockState();
    const pipeline = new RedisStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckRedisPlIn as any,
      outputClass: TckRedisPlOut as any,
    });

    await pipeline.start();

    await pipeline.pause();
    expect(pipeline.isRunning()).toBe(false);

    // Setup new mock for resume
    const ac2 = new AbortController();
    mockCreateConsumerLoopResult = {
      consumerTag: "pl-ctag-resume",
      groupName: "iris.pipeline.test2",
      streamKey: "iris:TckRedisPlIn",
      callback: vi.fn(),
      abortController: ac2,
      loopPromise: Promise.resolve(),
      connection: { disconnect: vi.fn().mockResolvedValue(undefined) } as any,
    };

    await pipeline.resume();
    expect(pipeline.isRunning()).toBe(true);
    expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(2); // start creates 1, resume creates 1

    // C3: resume creates a NEW group so messages published during pause are skipped
    const startGroupName = mockCreateConsumerLoop.mock.calls[0][0].groupName;
    const resumeGroupName = mockCreateConsumerLoop.mock.calls[1][0].groupName;
    expect(resumeGroupName).not.toBe(startGroupName);
    expect(resumeGroupName).toContain("iris.pipeline.");
  });

  it("should not double-start", async () => {
    const state = createMockState();
    const pipeline = new RedisStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckRedisPlIn as any,
      outputClass: TckRedisPlOut as any,
    });

    await pipeline.start();

    await pipeline.start(); // Should be no-op

    // Only created once because the loop still exists in consumerLoops
    expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);
  });
});
