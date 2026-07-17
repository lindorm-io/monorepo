// Redis Streams Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against real Redis.
// Requires Redis running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import { Broadcast } from "../../decorators/Broadcast.js";
import { Field } from "../../decorators/Field.js";
import { Message } from "../../decorators/Message.js";
import type { RedisDriver } from "../drivers/redis/classes/RedisDriver.js";
import type { RedisSharedState } from "../drivers/redis/types/redis-types.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { waitFor } from "../__fixtures__/tck/wait.js";
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
  driver: "redis",
  timeoutMs: 10000,
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
      driver: "redis",
      url: "redis://localhost:6379",
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
        const driver = (source as any)._driver as RedisDriver;
        await driver.reset();
        await source.purgeDeadLetters();
      },

      async forceReconnect() {
        const driver = (source as any)._driver as RedisDriver;
        const state = (driver as any).state;
        // Destroy the underlying socket to simulate a network drop; ioredis
        // auto-reconnects and the driver re-registers consumers on "ready".
        (state.publishConnection as any)?.stream?.destroy(
          new Error("tck forced reconnect"),
        );
        await waitFor(() => driver.getConnectionState() === "connected", 15000);
        const pending = (driver as any)._reconnecting;
        if (pending) await pending;
      },

      async teardown() {
        await source.disconnect();
      },
    };
  },
};

describe("TCK: Redis", () => {
  runTck(factory);
});

// M14: a non-broadcast worker-queue type must open exactly ONE consumer group —
// no dead broadcast consumer that can never receive. A broadcast type still
// opens its broadcast consumer.
describe("Redis worker-queue broadcast gating (M14)", () => {
  @Message({ name: "M14RedisNonBroadcast" })
  class M14RedisNonBroadcast implements IMessage {
    @Field("string") body!: string;
  }

  @Broadcast()
  @Message({ name: "M14RedisBroadcast" })
  class M14RedisBroadcast implements IMessage {
    @Field("string") body!: string;
  }

  const prefix = `iris-m14-${randomUUID().slice(0, 8)}`;
  let m14Source: IrisSource;

  beforeAll(async () => {
    m14Source = new IrisSource({
      driver: "redis",
      url: "redis://localhost:6379",
      prefix,
      logger: createMockLogger() as any,
      messages: [M14RedisNonBroadcast, M14RedisBroadcast],
    });
    await m14Source.connect();
    await m14Source.setup();
  });

  afterAll(async () => {
    await m14Source.disconnect();
  });

  const state = (): RedisSharedState =>
    (m14Source as any)._driver.state as RedisSharedState;

  test("non-broadcast type opens exactly one consumer group", async () => {
    const before = state().consumerRegistrations.length;

    const wq = m14Source.workerQueue(M14RedisNonBroadcast);
    await wq.consume("M14RedisNonBroadcast", async () => {});

    const added = state().consumerRegistrations.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0].streamKey).toBe(`${prefix}:M14RedisNonBroadcast`);
    // No `:broadcast` stream is ever registered for a non-broadcast type.
    expect(added.some((r) => r.streamKey.endsWith(":broadcast"))).toBe(false);

    await wq.unconsumeAll();
  });

  test("broadcast type opens main + broadcast consumer groups", async () => {
    const before = state().consumerRegistrations.length;

    const wq = m14Source.workerQueue(M14RedisBroadcast);
    await wq.consume("M14RedisBroadcast", async () => {});

    const added = state().consumerRegistrations.slice(before);
    expect(added).toHaveLength(2);
    expect(added.some((r) => r.streamKey === `${prefix}:M14RedisBroadcast`)).toBe(true);
    expect(
      added.some((r) => r.streamKey === `${prefix}:M14RedisBroadcast:broadcast`),
    ).toBe(true);

    await wq.unconsumeAll();
  });
});
