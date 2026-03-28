import type { IMessage } from "../../interfaces";
import type { MessageMetadata } from "../message/types/metadata";
import type { IrisEnvelope } from "../types/iris-envelope";
import {
  consumeMessageCore,
  type ConsumerCallbackHost,
  type ConsumeStrategies,
  type ConsumeMessageCoreOptions,
} from "./consume-message-core";

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createMockHost = <M extends IMessage>(): ConsumerCallbackHost<M> => ({
  prepareForConsume: jest.fn().mockResolvedValue({ data: "hydrated" }),
  afterConsumeSuccess: jest.fn().mockResolvedValue(undefined),
  onConsumeError: jest.fn().mockResolvedValue(undefined),
});

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  payload: Buffer.from("test"),
  headers: {},
  topic: "test-topic",
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant" as const,
  retryDelay: 100,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
  ...overrides,
});

const createMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    deadLetter: false,
    namespace: null,
    version: 1,
    message: { name: "TestMessage" },
    ...overrides,
  }) as unknown as MessageMetadata;

const createStrategies = (): ConsumeStrategies => ({
  onExpired: jest.fn().mockResolvedValue(undefined),
  onDeserializationError: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined),
  onRetryFailed: jest.fn().mockResolvedValue(undefined),
  deadLetter: jest.fn().mockResolvedValue(undefined),
  onExhaustedNoDeadLetter: jest.fn().mockResolvedValue(undefined),
  onSuccess: jest.fn().mockResolvedValue(undefined),
});

describe("consumeMessageCore", () => {
  describe("happy path", () => {
    it("should call prepareForConsume, callback, onSuccess, and afterConsumeSuccess", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockResolvedValue(undefined);
      const strategies = createStrategies();
      const logger = createMockLogger();

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(host.prepareForConsume).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        { data: "hydrated" },
        expect.objectContaining({ topic: "test-topic" }),
      );
      expect(strategies.onSuccess).toHaveBeenCalled();
      expect(host.afterConsumeSuccess).toHaveBeenCalledWith({ data: "hydrated" });
    });

    it("should build ConsumeEnvelope with metadata fields", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockResolvedValue(undefined);
      const strategies = createStrategies();
      const logger = createMockLogger();
      const metadata = createMetadata({ namespace: "my-ns", version: 3 });

      const envelope = createEnvelope({
        topic: "orders.created",
        headers: { "x-trace": "abc" },
        attempt: 2,
        correlationId: "corr-1",
        timestamp: 1700000000000,
      });

      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata,
        logger: logger as any,
        strategies,
      });

      expect(callback.mock.calls[0][1]).toMatchSnapshot();
    });
  });

  describe("expiry", () => {
    it("should skip expired envelopes and call onExpired", async () => {
      const host = createMockHost();
      const callback = jest.fn();
      const strategies = createStrategies();
      const logger = createMockLogger();

      const envelope = createEnvelope({
        timestamp: Date.now() - 10_000,
        expiry: 1000,
      });

      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(host.prepareForConsume).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(strategies.onExpired).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "Skipping expired message",
        expect.any(Object),
      );
    });
  });

  describe("deserialization failure", () => {
    it("should call onDeserializationError strategy", async () => {
      const host = createMockHost();
      (host.prepareForConsume as jest.Mock).mockRejectedValue(new Error("bad data"));
      const callback = jest.fn();
      const strategies = createStrategies();
      const logger = createMockLogger();

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(callback).not.toHaveBeenCalled();
      expect(host.onConsumeError).not.toHaveBeenCalled();
      expect(strategies.onDeserializationError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ message: "bad data" }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.any(Object),
      );
    });

    it("should wrap non-Error throws in deserialization", async () => {
      const host = createMockHost();
      (host.prepareForConsume as jest.Mock).mockRejectedValue("string error");
      const callback = jest.fn();
      const strategies = createStrategies();
      const logger = createMockLogger();

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(strategies.onDeserializationError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ message: "string error" }),
      );
    });
  });

  describe("callback error - retry", () => {
    it("should call retry strategy when attempts remain", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockRejectedValue(new Error("fail"));
      const strategies = createStrategies();
      const logger = createMockLogger();

      const envelope = createEnvelope({ maxRetries: 3, retryDelay: 100 });

      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(strategies.retry).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1 }),
        "test-topic",
        100,
      );
    });

    it("should call onRetryFailed when retry strategy throws", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockRejectedValue(new Error("fail"));
      const strategies = createStrategies();
      (strategies.retry as jest.Mock).mockRejectedValue(new Error("retry failed"));
      const logger = createMockLogger();

      const envelope = createEnvelope({ maxRetries: 3, retryDelay: 100 });

      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(strategies.onRetryFailed).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ message: "fail" }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Retry publish failed, sending to dead letter",
        expect.any(Object),
      );
    });
  });

  describe("callback error - exhausted retries", () => {
    it("should call deadLetter strategy when retries exhausted and deadLetter enabled", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockRejectedValue(new Error("permanent"));
      const strategies = createStrategies();
      const logger = createMockLogger();

      const envelope = createEnvelope({ attempt: 3, maxRetries: 3 });

      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata: createMetadata({ deadLetter: true }),
        logger: logger as any,
        strategies,
      });

      expect(strategies.deadLetter).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "test-topic" }),
        "test-topic",
        expect.objectContaining({ message: "permanent" }),
      );
    });

    it("should call onExhaustedNoDeadLetter when no dead letter", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockRejectedValue(new Error("fail"));
      const strategies = createStrategies();
      const logger = createMockLogger();

      const envelope = createEnvelope({ attempt: 3, maxRetries: 3 });

      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata: createMetadata({ deadLetter: false }),
        logger: logger as any,
        strategies,
      });

      expect(strategies.deadLetter).not.toHaveBeenCalled();
      expect(strategies.onExhaustedNoDeadLetter).toHaveBeenCalled();
    });
  });

  describe("afterConsumeSuccess hook", () => {
    it("should log and swallow afterConsumeSuccess errors", async () => {
      const host = createMockHost();
      (host.afterConsumeSuccess as jest.Mock).mockRejectedValue(new Error("hook failed"));
      const callback = jest.fn().mockResolvedValue(undefined);
      const strategies = createStrategies();
      const logger = createMockLogger();

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(host.afterConsumeSuccess).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "afterConsumeSuccess hook failed",
        expect.any(Object),
      );
      expect(host.onConsumeError).not.toHaveBeenCalled();
    });
  });

  describe("inFlightCounter", () => {
    it("should increment before processing and decrement after", async () => {
      const host = createMockHost();
      let capturedCount = -1;
      const callback = jest.fn().mockImplementation(async () => {
        capturedCount = counter.value;
      });
      const strategies = createStrategies();
      const logger = createMockLogger();
      const counter = { value: 0 };

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
        inFlightCounter: {
          increment: () => {
            counter.value++;
          },
          decrement: () => {
            counter.value--;
          },
        },
      });

      expect(capturedCount).toBe(1);
      expect(counter.value).toBe(0);
    });

    it("should decrement on error", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockRejectedValue(new Error("fail"));
      const strategies = createStrategies();
      const logger = createMockLogger();
      const counter = { value: 0 };

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
        inFlightCounter: {
          increment: () => {
            counter.value++;
          },
          decrement: () => {
            counter.value--;
          },
        },
      });

      expect(counter.value).toBe(0);
    });

    it("should decrement on deserialization failure", async () => {
      const host = createMockHost();
      (host.prepareForConsume as jest.Mock).mockRejectedValue(new Error("bad"));
      const callback = jest.fn();
      const strategies = createStrategies();
      const logger = createMockLogger();
      const counter = { value: 0 };

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
        inFlightCounter: {
          increment: () => {
            counter.value++;
          },
          decrement: () => {
            counter.value--;
          },
        },
      });

      expect(counter.value).toBe(0);
    });

    it("should not increment on expired messages", async () => {
      const host = createMockHost();
      const callback = jest.fn();
      const strategies = createStrategies();
      const logger = createMockLogger();
      const counter = { value: 0 };

      await consumeMessageCore(
        createEnvelope({ timestamp: Date.now() - 10_000, expiry: 1000 }),
        {
          host,
          callback,
          metadata: createMetadata(),
          logger: logger as any,
          strategies,
          inFlightCounter: {
            increment: () => {
              counter.value++;
            },
            decrement: () => {
              counter.value--;
            },
          },
        },
      );

      expect(counter.value).toBe(0);
    });
  });

  describe("error wrapping", () => {
    it("should wrap non-Error callback throws", async () => {
      const host = createMockHost();
      const callback = jest.fn().mockRejectedValue("string error");
      const strategies = createStrategies();
      const logger = createMockLogger();

      await consumeMessageCore(createEnvelope(), {
        host,
        callback,
        metadata: createMetadata(),
        logger: logger as any,
        strategies,
      });

      expect(host.onConsumeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" }),
        { data: "hydrated" },
      );
    });
  });
});
