// Kafka Driver Conformance Test (TCK) Harness — Core suites
//
// Runs core TCK suites against real Kafka (KRaft mode).
// Requires Kafka running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import type { KafkaDriver } from "../drivers/kafka/classes/KafkaDriver.js";
import type { KafkaSharedState } from "../drivers/kafka/types/kafka-types.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { waitFor } from "../__fixtures__/tck/wait.js";
import { stopAllKafkaConsumers } from "../drivers/kafka/utils/stop-kafka-consumer.js";
import { describe, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });

let source: IrisSource;

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const factory: TckDriverFactory = {
  driver: "kafka",
  timeoutMs: 8000,
  capabilities: {
    workerQueue: true,
    rpc: true,
    rpcFastFail: false,
    stream: true,
    delay: true,
    retry: true,
    deadLetter: true,
    broadcast: true,
    encryption: true,
    compression: true,
    strictOrdering: false,
    evenDistribution: false,
    exactlyOnce: false,
    priority: false,
  },
  async setup(messages: Array<Constructor<IMessage>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();
    const prefix = `iris-tck-${randomUUID().slice(0, 8)}`;

    const amphora = await createTckAmphora();

    source = new IrisSource({
      driver: "kafka",
      brokers: ["localhost:9092"],
      prefix,
      logger: logger as any,
      messages,
      amphora,
      sessionTimeoutMs: 15000,
    });

    await source.connect();
    await source.setup();

    return {
      amphora,

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
        return source.getDeadLetters(topic ? { topic } : undefined);
      },

      async purgeDeadLetters(topic?: string) {
        return source.purgeDeadLetters(topic ? { topic } : undefined);
      },

      async clear() {
        const driver = (source as any)._driver as KafkaDriver;
        await driver.reset();
        await source.purgeDeadLetters();
      },

      async forceReconnect() {
        const driver = (source as any)._driver as KafkaDriver;
        const state = (driver as any).state as KafkaSharedState;
        // Simulate a broker bounce that kills the consumers, then cycle the
        // producer so the driver's reconnect handler fires and re-registers
        // every consumer from the registry. Without the fix the consumers stay
        // dead and the post-reconnect publish is never consumed.
        await stopAllKafkaConsumers(state);
        await state.producer!.disconnect();
        await state.producer!.connect();
        await waitFor(() => driver.getConnectionState() === "connected", 20000);
        const pending = (driver as any)._reconnecting;
        if (pending) await pending;
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
    "reconnect",
  ]);
});
