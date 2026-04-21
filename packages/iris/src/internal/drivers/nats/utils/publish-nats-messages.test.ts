import type { NatsSharedState } from "../types/nats-types";
import { preparePublishBatch as _preparePublishBatch } from "../../../utils/prepare-publish-batch";
import { publishNatsMessages } from "./publish-nats-messages";
import { describe, expect, it, vi, type Mock } from "vitest";

const preparePublishBatch = _preparePublishBatch as unknown as Mock;

vi.mock("./resolve-subject", async () => ({
  resolveSubject: (prefix: string, topic: string) => `${prefix}.${topic}`,
}));

vi.mock("./serialize-nats-message", () => ({
  serializeNatsMessage: vi.fn().mockReturnValue({ data: new Uint8Array([1, 2, 3]) }),
}));

vi.mock("../../../utils/prepare-publish-batch", () => ({
  preparePublishBatch: vi.fn().mockResolvedValue([
    {
      message: { body: "hello" },
      envelope: { topic: "test", broadcast: false },
      topic: "test",
      delayed: false,
      delay: 0,
    },
  ]),
}));

const createMockState = (overrides?: Partial<NatsSharedState>): NatsSharedState => ({
  nc: {} as any,
  js: {
    publish: vi.fn().mockResolvedValue({ seq: 1, stream: "IRIS_TEST", duplicate: false }),
  } as any,
  jsm: null,
  headersInit: vi.fn() as any,
  prefix: "iris",
  streamName: "IRIS_IRIS",
  consumerLoops: [],
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  ...overrides,
});

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockDriver = () => ({
  prepareForPublish: vi.fn().mockResolvedValue({ envelope: {}, topic: "test" }),
  completePublish: vi.fn().mockResolvedValue(undefined),
  metadata: {} as any,
});

describe("publishNatsMessages", () => {
  it("should publish message via JetStream", async () => {
    const state = createMockState();
    const driver = createMockDriver();
    const logger = createMockLogger();

    await publishNatsMessages(
      { body: "hello" } as any,
      undefined,
      driver as any,
      state,
      logger as any,
    );

    expect(state.js!.publish).toHaveBeenCalledWith(
      "iris.test",
      new Uint8Array([1, 2, 3]),
    );
    expect(driver.completePublish).toHaveBeenCalledWith({ body: "hello" });
  });

  it("should throw when JetStream is not available", async () => {
    const state = createMockState({ js: null });
    const driver = createMockDriver();
    const logger = createMockLogger();

    await expect(
      publishNatsMessages(
        { body: "hello" } as any,
        undefined,
        driver as any,
        state,
        logger as any,
      ),
    ).rejects.toThrow("NATS JetStream connection not available");
  });

  it("should throw when headersInit is not available", async () => {
    const state = createMockState({ headersInit: null });
    const driver = createMockDriver();
    const logger = createMockLogger();

    await expect(
      publishNatsMessages(
        { body: "hello" } as any,
        undefined,
        driver as any,
        state,
        logger as any,
      ),
    ).rejects.toThrow("NATS JetStream connection not available");
  });

  it("should use broadcast subject for broadcast messages", async () => {
    preparePublishBatch.mockResolvedValueOnce([
      {
        message: { body: "broadcast" },
        envelope: { topic: "events", broadcast: true },
        topic: "events",
        delayed: false,
        delay: 0,
      },
    ]);

    const state = createMockState();
    const driver = createMockDriver();
    const logger = createMockLogger();

    await publishNatsMessages(
      { body: "broadcast" } as any,
      undefined,
      driver as any,
      state,
      logger as any,
    );

    expect(state.js!.publish).toHaveBeenCalledWith(
      "iris.events.broadcast",
      new Uint8Array([1, 2, 3]),
    );
  });

  it("should schedule via delayManager when message is delayed", async () => {
    preparePublishBatch.mockResolvedValueOnce([
      {
        message: { body: "delayed" },
        envelope: { topic: "test", broadcast: false },
        topic: "test",
        delayed: true,
        delay: 5000,
      },
    ]);

    const state = createMockState();
    const driver = createMockDriver();
    const logger = createMockLogger();
    const delayManager = { schedule: vi.fn().mockResolvedValue("delay-id") } as any;

    await publishNatsMessages(
      { body: "delayed" } as any,
      undefined,
      driver as any,
      state,
      logger as any,
      { delayManager },
    );

    expect(delayManager.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "test" }),
      "test",
      5000,
    );
    expect(state.js!.publish).not.toHaveBeenCalled();
  });

  it("should publish directly when delayed but no delayManager", async () => {
    preparePublishBatch.mockResolvedValueOnce([
      {
        message: { body: "delayed-no-manager" },
        envelope: { topic: "test", broadcast: false },
        topic: "test",
        delayed: true,
        delay: 5000,
      },
    ]);

    const state = createMockState();
    const driver = createMockDriver();
    const logger = createMockLogger();

    await publishNatsMessages(
      { body: "delayed-no-manager" } as any,
      undefined,
      driver as any,
      state,
      logger as any,
    );

    expect(state.js!.publish).toHaveBeenCalled();
  });

  it("should publish multiple messages in order", async () => {
    preparePublishBatch.mockResolvedValueOnce([
      {
        message: { body: "msg1" },
        envelope: { topic: "test1", broadcast: false },
        topic: "test1",
        delayed: false,
        delay: 0,
      },
      {
        message: { body: "msg2" },
        envelope: { topic: "test2", broadcast: false },
        topic: "test2",
        delayed: false,
        delay: 0,
      },
    ]);

    const state = createMockState();
    const driver = createMockDriver();
    const logger = createMockLogger();

    await publishNatsMessages(
      [{ body: "msg1" }, { body: "msg2" }] as any,
      undefined,
      driver as any,
      state,
      logger as any,
    );

    expect(state.js!.publish).toHaveBeenCalledTimes(2);
    expect(driver.completePublish).toHaveBeenCalledTimes(2);
  });
});
