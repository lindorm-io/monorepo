// NATS JetStream Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against real NATS with JetStream.
// Requires NATS running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import { Broadcast } from "../../decorators/Broadcast.js";
import { Field } from "../../decorators/Field.js";
import { Message } from "../../decorators/Message.js";
import type { NatsDriver } from "../drivers/nats/classes/NatsDriver.js";
import type { NatsSharedState } from "../drivers/nats/types/nats-types.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { tckCapabilities } from "../__fixtures__/tck/tck-capabilities.js";
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
  driver: "nats",
  timeoutMs: 10000,
  // Runtime flags read from the driver's own declaration (source.capabilities);
  // only the test-only observability knobs are hand-declared here.
  capabilities: tckCapabilities(
    {
      driver: "nats",
      servers: "localhost:4222",
      logger: createMockLogger() as any,
      messages: [],
    },
    {
      strictOrdering: false,
      evenDistribution: false,
      exactlyOnce: false,
    },
  ),
  async setup(messages: Array<Constructor<IMessage>>): Promise<TckDriverHandle> {
    const logger = createMockLogger();
    const prefix = `iris-tck-${randomUUID().slice(0, 8)}`;

    const amphora = await createTckAmphora();

    source = new IrisSource({
      driver: "nats",
      servers: "localhost:4222",
      prefix,
      logger: logger as any,
      messages,
      amphora,
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
        const driver = (source as any)._driver as NatsDriver;
        await driver.reset();
        await source.purgeDeadLetters();
      },

      async teardown() {
        await source.disconnect();
      },
    };
  },
};

describe("TCK: NATS", () => {
  runTck(factory);
});

// M14: a non-broadcast worker-queue type must open exactly ONE consumer — no
// dead broadcast consumer that can never receive. A broadcast type still opens
// its broadcast consumer.
describe("NATS worker-queue broadcast gating (M14)", () => {
  @Message({ name: "M14NatsNonBroadcast" })
  class M14NatsNonBroadcast implements IMessage {
    @Field("string") body!: string;
  }

  @Broadcast()
  @Message({ name: "M14NatsBroadcast" })
  class M14NatsBroadcast implements IMessage {
    @Field("string") body!: string;
  }

  const prefix = `iris-m14-${randomUUID().slice(0, 8)}`;
  let m14Source: IrisSource;

  beforeAll(async () => {
    m14Source = new IrisSource({
      driver: "nats",
      servers: "localhost:4222",
      prefix,
      logger: createMockLogger() as any,
      messages: [M14NatsNonBroadcast, M14NatsBroadcast],
    });
    await m14Source.connect();
    await m14Source.setup();
  });

  afterAll(async () => {
    await m14Source.disconnect();
  });

  const state = (): NatsSharedState =>
    (m14Source as any)._driver.state as NatsSharedState;

  test("non-broadcast type opens exactly one consumer", async () => {
    const before = state().consumerRegistrations.length;

    const wq = m14Source.workerQueue(M14NatsNonBroadcast);
    await wq.consume("M14NatsNonBroadcast", async () => {});

    const added = state().consumerRegistrations.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0].subject).toBe(`${prefix}.M14NatsNonBroadcast`);
    // No `.broadcast` subject is ever registered for a non-broadcast type.
    expect(added.some((r) => r.subject.endsWith(".broadcast"))).toBe(false);

    await wq.unconsumeAll();
  });

  test("broadcast type opens main + broadcast consumers", async () => {
    const before = state().consumerRegistrations.length;

    const wq = m14Source.workerQueue(M14NatsBroadcast);
    await wq.consume("M14NatsBroadcast", async () => {});

    const added = state().consumerRegistrations.slice(before);
    expect(added).toHaveLength(2);
    expect(added.some((r) => r.subject === `${prefix}.M14NatsBroadcast`)).toBe(true);
    expect(added.some((r) => r.subject === `${prefix}.M14NatsBroadcast.broadcast`)).toBe(
      true,
    );

    await wq.unconsumeAll();
  });
});
