import { createNatsConsumer } from "./create-nats-consumer";

jest.mock("@lindorm/random", () => ({
  randomUUID: jest.fn().mockReturnValue("mock-uuid-1234"),
}));

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createMockMessages = () => {
  const msgs: Array<any> = [];
  let resolve: (() => void) | undefined;
  const waitForIteration = new Promise<void>((r) => {
    resolve = r;
  });

  return {
    messages: {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          if (msgs.length > 0) {
            return { value: msgs.shift(), done: false };
          }
          resolve?.();
          return { value: undefined, done: true };
        },
      }),
      close: jest.fn(),
    },
    push: (msg: any) => msgs.push(msg),
    waitForIteration,
  };
};

describe("createNatsConsumer", () => {
  it("should create a durable consumer via jsm when not yet ensured", async () => {
    const { messages } = createMockMessages();
    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn().mockResolvedValue({}) } };
    const ensuredConsumers = new Set<string>();

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage: jest.fn(),
      logger: createMockLogger() as any,
      ensuredConsumers,
    });

    expect(jsm.consumers.add).toHaveBeenCalledWith(
      "IRIS_TEST",
      expect.objectContaining({
        durable_name: "test-consumer",
        name: "test-consumer",
        ack_policy: "explicit",
        deliver_policy: "new",
        filter_subject: "test.events",
        max_ack_pending: 10,
      }),
    );
    expect(ensuredConsumers.has("test-consumer")).toBe(true);
    expect(loop.consumerTag).toBe("mock-uuid-1234");
    expect(loop.streamName).toBe("IRIS_TEST");
    expect(loop.consumerName).toBe("test-consumer");
    expect(loop.subject).toBe("test.events");

    // Wait for loop to complete
    await loop.loopPromise;
  });

  it("should skip jsm.consumers.add when consumer is already ensured", async () => {
    const { messages } = createMockMessages();
    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn() } };
    const ensuredConsumers = new Set<string>(["test-consumer"]);

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage: jest.fn(),
      logger: createMockLogger() as any,
      ensuredConsumers,
    });

    expect(jsm.consumers.add).not.toHaveBeenCalled();

    await loop.loopPromise;
  });

  it("should tolerate 'already in use' error from jsm.consumers.add", async () => {
    const { messages } = createMockMessages();
    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = {
      consumers: {
        add: jest.fn().mockRejectedValue(new Error("consumer already in use")),
      },
    };
    const ensuredConsumers = new Set<string>();

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage: jest.fn(),
      logger: createMockLogger() as any,
      ensuredConsumers,
    });

    expect(ensuredConsumers.has("test-consumer")).toBe(true);

    await loop.loopPromise;
  });

  it("should rethrow unexpected errors from jsm.consumers.add", async () => {
    const js = { consumers: { get: jest.fn() } };
    const jsm = {
      consumers: { add: jest.fn().mockRejectedValue(new Error("connection refused")) },
    };

    await expect(
      createNatsConsumer({
        js: js as any,
        jsm: jsm as any,
        streamName: "IRIS_TEST",
        consumerName: "test-consumer",
        subject: "test.events",
        prefetch: 10,
        onMessage: jest.fn(),
        logger: createMockLogger() as any,
        ensuredConsumers: new Set(),
      }),
    ).rejects.toThrow("connection refused");
  });

  it("should use deliverPolicy 'all' when specified", async () => {
    const { messages } = createMockMessages();
    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn().mockResolvedValue({}) } };

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 5,
      onMessage: jest.fn(),
      logger: createMockLogger() as any,
      ensuredConsumers: new Set(),
      deliverPolicy: "all",
    });

    expect(jsm.consumers.add).toHaveBeenCalledWith(
      "IRIS_TEST",
      expect.objectContaining({ deliver_policy: "all" }),
    );

    await loop.loopPromise;
  });

  it("should call onMessage for each consumed message", async () => {
    const mockMsg = {
      data: new Uint8Array([1, 2, 3]),
      subject: "test.events",
      seq: 1,
    };
    const { messages, push } = createMockMessages();
    push(mockMsg);

    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn().mockResolvedValue({}) } };
    const onMessage = jest.fn().mockResolvedValue(undefined);

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage,
      logger: createMockLogger() as any,
      ensuredConsumers: new Set(),
    });

    await loop.loopPromise;

    expect(onMessage).toHaveBeenCalledWith(mockMsg);
  });

  it("should log error when onMessage throws but continue processing", async () => {
    const mockMsg1 = { data: new Uint8Array([1]), subject: "test.events", seq: 1 };
    const mockMsg2 = { data: new Uint8Array([2]), subject: "test.events", seq: 2 };
    const { messages, push } = createMockMessages();
    push(mockMsg1);
    push(mockMsg2);

    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn().mockResolvedValue({}) } };
    const logger = createMockLogger();
    const onMessage = jest
      .fn()
      .mockRejectedValueOnce(new Error("handler fail"))
      .mockResolvedValueOnce(undefined);

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage,
      logger: logger as any,
      ensuredConsumers: new Set(),
    });

    await loop.loopPromise;

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      "Consumer message handler failed",
      expect.objectContaining({ error: "handler fail" }),
    );
  });

  it("should resolve ready promise", async () => {
    const { messages } = createMockMessages();
    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn().mockResolvedValue({}) } };

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage: jest.fn(),
      logger: createMockLogger() as any,
      ensuredConsumers: new Set(),
    });

    await expect(loop.ready).resolves.toBeUndefined();
    await loop.loopPromise;
  });

  it("should return a valid NatsConsumerLoop structure", async () => {
    const { messages } = createMockMessages();
    const mockConsumer = { consume: jest.fn().mockResolvedValue(messages) };
    const js = { consumers: { get: jest.fn().mockResolvedValue(mockConsumer) } };
    const jsm = { consumers: { add: jest.fn().mockResolvedValue({}) } };

    const loop = await createNatsConsumer({
      js: js as any,
      jsm: jsm as any,
      streamName: "IRIS_TEST",
      consumerName: "test-consumer",
      subject: "test.events",
      prefetch: 10,
      onMessage: jest.fn(),
      logger: createMockLogger() as any,
      ensuredConsumers: new Set(),
    });

    expect(loop.consumerTag).toBe("mock-uuid-1234");
    expect(loop.streamName).toBe("IRIS_TEST");
    expect(loop.consumerName).toBe("test-consumer");
    expect(loop.subject).toBe("test.events");
    expect(loop.abortController).toBeInstanceOf(AbortController);
    expect(loop.loopPromise).toBeInstanceOf(Promise);
    expect(loop.ready).toBeInstanceOf(Promise);

    await loop.loopPromise;
  });
});
