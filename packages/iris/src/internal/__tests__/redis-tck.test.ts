// Redis Streams Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against real Redis.
// Requires Redis running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import type { RedisDriver } from "../drivers/redis/classes/RedisDriver.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { createMockAesModule } from "../__fixtures__/tck/mock-aes.js";
import { describe, vi } from "vitest";

vi.mock("@lindorm/aes", () => createMockAesModule());

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

const mockAmphora = {
  find: vi.fn().mockResolvedValue({ id: "mock-kryptos-key" }),
  findById: vi.fn().mockResolvedValue({ id: "mock-kryptos-key" }),
};

const factory: TckDriverFactory = {
  driver: "redis",
  timeoutMs: 10000,
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
      driver: "redis",
      url: "redis://localhost:6379",
      prefix,
      logger: logger as any,
      messages,
      amphora: mockAmphora as any,
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
        const driver = (source as any)._driver as RedisDriver;
        await driver.reset();
        const dlm = (source as any)._deadLetterManager;
        if (dlm) await dlm.purge();
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
