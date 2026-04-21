// Memory Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against the in-memory driver.
// No external services required.

import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces";
import { IrisSource } from "../../classes/IrisSource";
import type { MemoryDriver } from "../drivers/memory/classes/MemoryDriver";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types";
import { runTck } from "../__fixtures__/tck/run-tck";
import { createMockAesModule } from "../__fixtures__/tck/mock-aes";
import { describe, vi } from "vitest";

vi.mock("@lindorm/aes", () => createMockAesModule());

vi.setConfig({ testTimeout: 30_000 });

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
  driver: "memory",
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

    source = new IrisSource({
      driver: "memory",
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
        const driver = (source as any)._driver as MemoryDriver;
        return driver.getDeadLetters(topic);
      },

      async clear() {
        const driver = (source as any)._driver as MemoryDriver;
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

describe("TCK: Memory", () => {
  runTck(factory);
});
