import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState, NatsConsumerLoop } from "../types/nats-types";
import { NatsStreamPipeline } from "./NatsStreamPipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
let mockCreateNatsConsumerResult: Partial<NatsConsumerLoop>;
const mockCreateNatsConsumer = vi
  .fn()
  .mockImplementation(async () => mockCreateNatsConsumerResult);
vi.mock("../utils/create-nats-consumer", async () => ({
  createNatsConsumer: (...args: Array<unknown>) => mockCreateNatsConsumer(...args),
}));

const mockStopNatsConsumer = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/stop-nats-consumer", () => ({
  stopNatsConsumer: (...args: Array<unknown>) => mockStopNatsConsumer(...args),
  stopAllNatsConsumers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/serialize-nats-message", () => ({
  serializeNatsMessage: vi.fn().mockReturnValue({ data: new Uint8Array([1, 2, 3]) }),
}));

vi.mock("../utils/parse-nats-message", () => ({
  parseNatsMessage: vi.fn().mockReturnValue({
    payload: Buffer.from("{}"),
    headers: {},
    topic: "TckNatsPlIn",
    attempt: 0,
    maxRetries: 0,
    retryStrategy: "constant",
    retryDelay: 1000,
    retryDelayMax: 30000,
    retryMultiplier: 2,
    retryJitter: false,
    priority: 0,
    timestamp: 0,
    expiry: null,
    broadcast: false,
    replyTo: null,
    correlationId: null,
    identifierValue: null,
  }),
}));

// --- Test messages ---

@Message({ name: "TckNatsPlIn" })
class TckNatsPlIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckNatsPlOut" })
class TckNatsPlOut implements IMessage {
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

const createMockState = (): NatsSharedState => ({
  nc: {} as any,
  js: {
    publish: vi.fn().mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
    consumers: { get: vi.fn() },
  } as any,
  jsm: {
    streams: { info: vi.fn(), add: vi.fn(), purge: vi.fn() },
    consumers: {
      add: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(true),
    },
  } as any,
  headersInit: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    values: vi.fn(),
  }) as any,
  prefix: "iris",
  streamName: "IRIS_IRIS",
  consumerLoops: [],
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
});

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockCreateNatsConsumer.mockClear();
  mockStopNatsConsumer.mockClear();
  mockCreateNatsConsumerResult = {
    consumerTag: "pl-ctag",
    streamName: "IRIS_IRIS",
    consumerName: "iris_pipeline_test",
    subject: "iris.TckNatsPlIn",
    messages: null,
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    ready: Promise.resolve(),
  };
});

describe("NatsStreamPipeline", () => {
  it("should throw when no inputClass provided", async () => {
    const state = createMockState();
    const pipeline = new NatsStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      outputClass: TckNatsPlOut as any,
    });

    await expect(pipeline.start()).rejects.toThrow(
      "Stream pipeline requires an input class",
    );
  });

  it("should start successfully", async () => {
    const state = createMockState();
    const pipeline = new NatsStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckNatsPlIn as any,
      outputClass: TckNatsPlOut as any,
    });

    await pipeline.start();

    expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(1);
    expect(pipeline.isRunning()).toBe(true);
  });

  it("should stop and clean up consumer", async () => {
    const state = createMockState();
    const pipeline = new NatsStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckNatsPlIn as any,
      outputClass: TckNatsPlOut as any,
    });

    await pipeline.start();

    await pipeline.stop();

    expect(mockStopNatsConsumer).toHaveBeenCalledTimes(1);
    expect(pipeline.isRunning()).toBe(false);
  });

  it("should pause and resume", async () => {
    const state = createMockState();
    const pipeline = new NatsStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckNatsPlIn as any,
      outputClass: TckNatsPlOut as any,
    });

    await pipeline.start();

    await pipeline.pause();
    expect(pipeline.isRunning()).toBe(false);

    // Setup new mock for resume
    mockCreateNatsConsumerResult = {
      consumerTag: "pl-ctag-resume",
      streamName: "IRIS_IRIS",
      consumerName: "iris_pipeline_resume",
      subject: "iris.TckNatsPlIn",
      messages: null,
      abortController: new AbortController(),
      loopPromise: Promise.resolve(),
      ready: Promise.resolve(),
    };

    await pipeline.resume();
    expect(pipeline.isRunning()).toBe(true);
    expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(2); // start creates 1, resume creates 1

    // Resume creates a NEW consumer so messages published during pause are skipped
    const startConsumerName = mockCreateNatsConsumer.mock.calls[0][0].consumerName;
    const resumeConsumerName = mockCreateNatsConsumer.mock.calls[1][0].consumerName;
    expect(resumeConsumerName).not.toBe(startConsumerName);
    expect(resumeConsumerName).toContain("iris_pipeline_");
  });

  it("should not double-start", async () => {
    const state = createMockState();
    // Push the loop so the consumerTag check succeeds on second start
    state.consumerLoops.push(mockCreateNatsConsumerResult as NatsConsumerLoop);

    const pipeline = new NatsStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckNatsPlIn as any,
      outputClass: TckNatsPlOut as any,
    });

    await pipeline.start();

    await pipeline.start(); // Should be no-op

    // Only created once because the loop still exists in consumerLoops
    expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(1);
  });

  it("should throw when connection is not available", async () => {
    const state = createMockState();
    state.js = null;
    state.jsm = null;

    const pipeline = new NatsStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckNatsPlIn as any,
      outputClass: TckNatsPlOut as any,
    });

    await expect(pipeline.start()).rejects.toThrow(
      "Cannot start stream pipeline: connection is not available",
    );
  });
});
