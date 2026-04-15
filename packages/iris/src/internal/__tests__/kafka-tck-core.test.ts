// Kafka Driver Conformance Test (TCK) Harness — Core suites
//
// Runs core TCK suites against real Kafka (KRaft mode).
// Requires Kafka running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces";
import { IrisSource } from "../../classes/IrisSource";
import type { KafkaDriver } from "../drivers/kafka/classes/KafkaDriver";
import type { KafkaSharedState } from "../drivers/kafka/types/kafka-types";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { runTck } from "../__fixtures__/tck/run-tck";
import { createMockAesModule } from "../__fixtures__/tck/mock-aes";

jest.mock("@lindorm/aes", () => createMockAesModule());

jest.setTimeout(60_000);

let source: IrisSource;

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
  driver: "kafka",
  timeoutMs: 8000,
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
    const prefix = `iris-tck-${randomUUID().slice(0, 8)}`;

    source = new IrisSource({
      driver: "kafka",
      brokers: ["localhost:9092"],
      prefix,
      logger: logger as any,
      messages,
      amphora: mockAmphora as any,
      sessionTimeoutMs: 6000,
    });

    await source.connect();
    await source.setup();

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
        const dlm = (source as any)._deadLetterManager;
        if (!dlm) return [];
        if (topic) {
          return dlm.list({ topic });
        }
        return dlm.list();
      },

      async clear() {
        const driver = (source as any)._driver as KafkaDriver;
        await driver.reset();
        const dlm = (source as any)._deadLetterManager;
        if (dlm) await dlm.purge();
      },

      async teardown() {
        // Abort handlers immediately — prevents new message processing.
        // Skip graceful consumer stop (consumer.stop() triggers KafkaJS
        // leaveGroup protocol which races Jest environment teardown and
        // causes ReferenceError warnings). Docker cleanup handles
        // connection closure.
        const drv = (source as any)._driver as KafkaDriver;
        const state = (drv as any).state as KafkaSharedState;
        state.abortController.abort();
        for (const [, p] of state.consumerPool) p.localAbort.abort();
        state.consumers.length = 0;
        state.consumerPool.clear();

        try {
          await state.producer?.disconnect();
        } catch {}
        try {
          await state.admin?.disconnect();
        } catch {}
        state.kafka = null;
      },
    };
  },
};

describe("TCK: Kafka (core)", () => {
  runTck(factory, [
    "publish-subscribe",
    "fan-out",
    "topic-resolution",
    "hooks",
    "headers",
    "decorator-coverage",
    "error-resilience",
    "delay",
    "broadcast",
    "encryption",
    "compression",
    "expiry",
  ]);
});
