// Kafka Driver Conformance Test (TCK) Harness — Core suites
//
// Runs core TCK suites against real Kafka (KRaft mode).
// Requires Kafka running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import { Broadcast } from "../../decorators/Broadcast.js";
import { Field } from "../../decorators/Field.js";
import { Message } from "../../decorators/Message.js";
import type { KafkaDriver } from "../drivers/kafka/classes/KafkaDriver.js";
import type { KafkaSharedState } from "../drivers/kafka/types/kafka-types.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { tckCapabilities } from "../__fixtures__/tck/tck-capabilities.js";
import { waitFor } from "../__fixtures__/tck/wait.js";
import { stopAllKafkaConsumers } from "../drivers/kafka/utils/stop-kafka-consumer.js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

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
  // Runtime flags read from the driver's own declaration (source.capabilities);
  // only the test-only observability knobs are hand-declared here.
  capabilities: tckCapabilities(
    {
      driver: "kafka",
      brokers: ["localhost:9092"],
      logger: createMockLogger() as any,
      messages: [],
    },
    {
      strictOrdering: false,
      evenDistribution: false,
      exactlyOnce: false,
      priority: false,
    },
  ),
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

// M14: a non-broadcast worker-queue type must open exactly ONE consumer group
// and must NOT auto-create a `.broadcast` topic. A broadcast type still opens
// its broadcast consumer.
describe("Kafka worker-queue broadcast gating (M14)", () => {
  @Message({ name: "M14KafkaNonBroadcast" })
  class M14KafkaNonBroadcast implements IMessage {
    @Field("string") body!: string;
  }

  @Broadcast()
  @Message({ name: "M14KafkaBroadcast" })
  class M14KafkaBroadcast implements IMessage {
    @Field("string") body!: string;
  }

  const prefix = `iris-m14-${randomUUID().slice(0, 8)}`;
  let m14Source: IrisSource;

  beforeAll(async () => {
    m14Source = new IrisSource({
      driver: "kafka",
      brokers: ["localhost:9092"],
      prefix,
      logger: createMockLogger() as any,
      messages: [M14KafkaNonBroadcast, M14KafkaBroadcast],
      sessionTimeoutMs: 15000,
    });
    await m14Source.connect();
    await m14Source.setup();
  });

  afterAll(async () => {
    await m14Source.disconnect();
  });

  const state = (): KafkaSharedState =>
    (m14Source as any)._driver.state as KafkaSharedState;

  test("non-broadcast type opens one consumer and no .broadcast topic", async () => {
    const before = state().consumerRegistrations.length;

    const wq = m14Source.workerQueue(M14KafkaNonBroadcast);
    await wq.consume("M14KafkaNonBroadcast", async () => {});

    const added = state().consumerRegistrations.slice(before);
    // Exactly ONE delivery consumer. The per-group retry topic attaches lazily
    // (M1) — only on the first actual retry — so a type that never fails
    // registers no retry consumer here, and nothing broadcast-related.
    expect(added).toHaveLength(1);
    expect(added.some((r) => r.topic === `${prefix}.M14KafkaNonBroadcast`)).toBe(true);
    expect(
      added.some((r) => r.topic.startsWith(`${prefix}.M14KafkaNonBroadcast.retry.`)),
    ).toBe(false);
    // No `.broadcast` topic is ever subscribed or auto-created for a
    // non-broadcast type.
    expect(added.some((r) => r.topic.endsWith(".broadcast"))).toBe(false);
    expect(state().createdTopics.has(`${prefix}.M14KafkaNonBroadcast.broadcast`)).toBe(
      false,
    );

    await wq.unconsumeAll();
  });

  test("broadcast type opens main + broadcast consumers", async () => {
    const before = state().consumerRegistrations.length;

    const wq = m14Source.workerQueue(M14KafkaBroadcast);
    await wq.consume("M14KafkaBroadcast", async () => {});

    const added = state().consumerRegistrations.slice(before);
    // main + broadcast delivery consumers = 2. Retry topics attach lazily (M1),
    // so neither group registers a retry consumer until it actually retries.
    expect(added).toHaveLength(2);
    expect(added.some((r) => r.topic === `${prefix}.M14KafkaBroadcast`)).toBe(true);
    expect(added.some((r) => r.topic === `${prefix}.M14KafkaBroadcast.broadcast`)).toBe(
      true,
    );
    expect(
      added.some((r) => r.topic.startsWith(`${prefix}.M14KafkaBroadcast.retry.`)),
    ).toBe(false);
    expect(added.some((r) => r.topic.includes(".retry."))).toBe(false);

    await wq.unconsumeAll();
  });
});

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
