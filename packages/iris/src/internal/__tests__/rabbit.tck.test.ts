// Rabbit Driver Conformance Test (TCK) Harness
//
// Runs the full TCK suite against real RabbitMQ.
// Requires RabbitMQ running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import type { RabbitDriver } from "../drivers/rabbit/classes/RabbitDriver.js";
import type { TckDriverFactory, TckDriverHandle } from "../__fixtures__/tck/types.js";
import { runTck } from "../__fixtures__/tck/run-tck.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { tckCapabilities } from "../__fixtures__/tck/tck-capabilities.js";
import { waitFor } from "../__fixtures__/tck/wait.js";
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
  driver: "rabbit",
  // Runtime flags read from the driver's own declaration (source.capabilities);
  // only the test-only observability knobs are hand-declared here.
  capabilities: tckCapabilities(
    {
      driver: "rabbit",
      url: "amqp://localhost:5672",
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
    const exchange = `iris-tck-${randomUUID().slice(0, 8)}`;

    const amphora = await createTckAmphora();

    source = new IrisSource({
      driver: "rabbit",
      url: "amqp://localhost:5672",
      exchange,
      logger: logger as any,
      messages,
      amphora,
      // prefetch 1 so a single consumer drains the queue strictly one message
      // at a time. This makes priority-queue ordering deterministic: the broker
      // dispatches the highest-priority waiting message before lower-priority
      // ones, and never has more than one unacked delivery in flight.
      prefetch: 1,
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
        const driver = (source as any)._driver as RabbitDriver;
        await driver.reset();
        // Drain the native DLQ so dead letters don't leak between tests
        await source.purgeDeadLetters();
      },

      async forceReconnect() {
        const driver = (source as any)._driver as RabbitDriver;
        const state = (driver as any).state;
        // Close the underlying connection WITHOUT going through
        // driver.disconnect(), so the driver treats it as an unexpected drop
        // and runs its reconnect + consumer re-registration path.
        await state.connection.close();
        await waitFor(
          () =>
            driver.getConnectionState() === "connected" &&
            state.reconnecting === false &&
            state.consumeChannel != null,
          20000,
        );
      },

      async teardown() {
        await source.disconnect();
      },
    };
  },
};

describe("TCK: Rabbit", () => {
  runTck(factory);
});
