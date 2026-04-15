// Rabbit Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against real RabbitMQ.
// Requires RabbitMQ running (via docker-compose).

import amqplib from "amqplib";
import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces";
import type { DeadLetterEntry } from "../../types/dead-letter";
import { IrisSource } from "../../classes/IrisSource";
import type { RabbitDriver } from "../drivers/rabbit/classes/RabbitDriver";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { runTck } from "../__fixtures__/tck/run-tck";
import { createMockAesModule } from "../__fixtures__/tck/mock-aes";

jest.mock("@lindorm/aes", () => createMockAesModule());

jest.setTimeout(60_000);

let source: IrisSource;
let dlqChannel: amqplib.Channel | null = null;
let dlqConnection: amqplib.ChannelModel | null = null;
let dlqConsumerTag: string | null = null;
const collectedDeadLetters: Array<DeadLetterEntry> = [];

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const mockAmphora = {
  find: jest.fn().mockResolvedValue({ id: "mock-kryptos-key" }),
  findById: jest.fn().mockResolvedValue({ id: "mock-kryptos-key" }),
};

const factory: TckDriverFactory = {
  driver: "rabbit",
  capabilities: {
    workerQueue: true,
    rpc: true,
    stream: true,
    delay: true,
    retry: true,
    deadLetter: true,
    broadcast: true,
    encryption: true,
    compression: true,
  },
  async setup(messages: Array<Constructor<IMessage>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();
    const exchange = `iris-tck-${randomUUID().slice(0, 8)}`;
    const dlqQueue = `${exchange}.dlq`;

    source = new IrisSource({
      driver: "rabbit",
      url: "amqp://localhost:5672",
      exchange,
      logger: logger as any,
      messages,
      amphora: mockAmphora as any,
    });

    await source.connect();
    await source.setup();

    // Set up a dedicated DLQ consumer on a separate connection
    dlqConnection = await amqplib.connect("amqp://localhost:5672");
    dlqChannel = await dlqConnection.createChannel();
    collectedDeadLetters.length = 0;

    const { consumerTag } = await dlqChannel.consume(dlqQueue, (msg) => {
      if (!msg) return;

      const headers = (msg.properties.headers ?? {}) as Record<string, unknown>;
      const topic = String(msg.fields.routingKey ?? "");
      const errorMessage = headers["x-iris-error"]
        ? Buffer.isBuffer(headers["x-iris-error"])
          ? (headers["x-iris-error"] as Buffer).toString()
          : String(headers["x-iris-error"])
        : "unknown error";
      const errorTimestamp = headers["x-iris-error-timestamp"]
        ? Number(
            Buffer.isBuffer(headers["x-iris-error-timestamp"])
              ? (headers["x-iris-error-timestamp"] as Buffer).toString()
              : String(headers["x-iris-error-timestamp"]),
          )
        : Date.now();

      collectedDeadLetters.push({
        id: randomUUID(),
        envelope: {
          topic,
          payload: msg.content,
          headers: {},
          priority: msg.properties.priority ?? 0,
          timestamp: msg.properties.timestamp ?? Date.now(),
          expiry: null,
          broadcast: false,
          attempt: 0,
          maxRetries: 0,
          retryStrategy: "constant",
          retryDelay: 0,
          retryDelayMax: 0,
          retryMultiplier: 0,
          retryJitter: false,
          replyTo: null,
          correlationId: null,
          identifierValue: null,
        },
        error: errorMessage,
        errorStack: null,
        attempt: 0,
        timestamp: errorTimestamp,
        topic,
      });

      dlqChannel!.ack(msg);
    });
    dlqConsumerTag = consumerTag;

    return {
      messageBus<M extends IMessage>(target: Constructor<M>) {
        return source.messageBus(target);
      },

      publisher<M extends IMessage>(target: Constructor<M>) {
        return source.publisher(target);
      },

      workerQueue<M extends IMessage>(target: Constructor<M>) {
        return source.workerQueue(target);
      },

      stream() {
        return source.stream();
      },

      rpcClient(requestTarget, responseTarget) {
        return source.rpcClient(requestTarget, responseTarget);
      },

      rpcServer(requestTarget, responseTarget) {
        return source.rpcServer(requestTarget, responseTarget);
      },

      async getDeadLetters(topic?: string) {
        if (topic) {
          return collectedDeadLetters.filter((entry) => entry.topic === topic);
        }
        return [...collectedDeadLetters];
      },

      async clear() {
        const driver = (source as any)._driver as RabbitDriver;
        await driver.reset();
        collectedDeadLetters.length = 0;
        // Purge DLQ so dead letters don't leak between tests
        if (dlqChannel) {
          try {
            await dlqChannel.purgeQueue(dlqQueue);
          } catch {
            // Queue may not exist yet
          }
        }
      },

      async teardown() {
        if (dlqConsumerTag && dlqChannel) {
          try {
            await dlqChannel.cancel(dlqConsumerTag);
          } catch {
            // Already cancelled
          }
        }
        if (dlqChannel) {
          try {
            await dlqChannel.close();
          } catch {
            // Already closed
          }
          dlqChannel = null;
        }
        if (dlqConnection) {
          try {
            await dlqConnection.close();
          } catch {
            // Already closed
          }
          dlqConnection = null;
        }
        await source.disconnect();
      },
    };
  },
};

describe("TCK: Rabbit", () => {
  runTck(factory);
});
