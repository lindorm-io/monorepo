// ⭐ A declared `subscriptions` entry must actually RECEIVE a published message.
//
// `PylonSettings.subscriptions` was accepted by the type and read by nothing:
// `subscribe()` wired Pylon's own audit and webhook consumers and never looked at
// the option, and no scanner covers bus subscriptions either (they cover routes,
// listeners and workers). A deployment that named a topic and a callback got
// silence, with no error — the same accepted-then-discarded shape as the dropped
// conduit base URL.
//
// So nothing here asserts that a mock was called with a shape. The bus is a real
// `IrisSource` on the memory driver, Pylon connects and sets it up the way it
// does in production, and the assertions are on what the declared callback
// RECEIVED after a real publish.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { Field, IrisSource, Message, Topic } from "@lindorm/iris";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { Pylon } from "./Pylon.js";

const ISSUER = "http://test.lindorm.io";

@Message()
@Topic("pylon.test.subscription")
class TestSubscription {
  @Field("string")
  readonly value!: string;
}

let buses: Array<IrisSource> = [];

const createBus = (): IrisSource => {
  const bus = new IrisSource({ driver: "memory", logger: createMockLogger() });
  buses.push(bus);
  return bus;
};

const createAmphora = (): IAmphora => {
  const logger = createMockLogger();
  return new Amphora({ internal: { issuer: ISSUER }, logger });
};

const createPylon = (options: Record<string, unknown>): Pylon =>
  new Pylon({
    logger: createMockLogger(),
    amphora: createAmphora(),
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon",
    port: 55603,
    version: "0.0.1",
    ...options,
  } as any);

afterEach(async () => {
  for (const bus of buses) {
    await bus.disconnect().catch(() => undefined);
  }
  buses = [];
});

describe("Pylon bus subscriptions", () => {
  test("should deliver a published message to a declared subscription", async () => {
    const bus = createBus();
    const received: Array<TestSubscription> = [];

    const pylon = createPylon({
      bus,
      subscriptions: [
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          callback: async (message: TestSubscription) => {
            received.push(message);
          },
        },
      ],
    });

    await pylon.setup();

    const messageBus = bus.messageBus(TestSubscription);
    await messageBus.publish(messageBus.create({ value: "delivered" }));

    expect(received).toHaveLength(1);
    expect(received[0].value).toBe("delivered");
  });

  test("should hand the declared callback the consume envelope alongside the message", async () => {
    const bus = createBus();
    const topics: Array<string> = [];

    const pylon = createPylon({
      bus,
      subscriptions: [
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          callback: async (_: TestSubscription, envelope: { topic: string }) => {
            topics.push(envelope.topic);
          },
        },
      ],
    });

    await pylon.setup();

    const messageBus = bus.messageBus(TestSubscription);
    await messageBus.publish(messageBus.create({ value: "enveloped" }));

    expect(topics).toEqual(["pylon.test.subscription"]);
  });

  // A named queue is a consumer group rather than a broadcast, and it is the
  // shape a deployment reaches for most: it must still deliver.
  test("should deliver to a subscription that names a queue", async () => {
    const bus = createBus();
    const received: Array<string> = [];

    const pylon = createPylon({
      bus,
      subscriptions: [
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          queue: "test-consumers",
          callback: async (message: TestSubscription) => {
            received.push(message.value);
          },
        },
      ],
    });

    await pylon.setup();

    const messageBus = bus.messageBus(TestSubscription);
    await messageBus.publish(messageBus.create({ value: "queued" }));

    expect(received).toEqual(["queued"]);
  });

  test("should deliver to every one of several declared subscriptions", async () => {
    const bus = createBus();
    const first: Array<string> = [];
    const second: Array<string> = [];

    const pylon = createPylon({
      bus,
      subscriptions: [
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          queue: "first",
          callback: async (message: TestSubscription) => {
            first.push(message.value);
          },
        },
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          queue: "second",
          callback: async (message: TestSubscription) => {
            second.push(message.value);
          },
        },
      ],
    });

    await pylon.setup();

    const messageBus = bus.messageBus(TestSubscription);
    await messageBus.publish(messageBus.create({ value: "fanned" }));

    expect(first).toEqual(["fanned"]);
    expect(second).toEqual(["fanned"]);
  });

  // The deployment never listed the class in `new IrisSource({ messages })` — it
  // named it on the subscription, and that is the one declaration Pylon needs.
  test("should register a declared subscription's message on the bus", async () => {
    const bus = createBus();

    expect(bus.hasMessage(TestSubscription)).toBe(false);

    const pylon = createPylon({
      bus,
      subscriptions: [
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          callback: async () => undefined,
        },
      ],
    });

    await pylon.setup();

    expect(bus.hasMessage(TestSubscription)).toBe(true);
  });

  test("should throw when subscriptions are declared with no bus", async () => {
    const pylon = createPylon({
      subscriptions: [
        {
          message: TestSubscription,
          topic: "pylon.test.subscription",
          callback: async () => undefined,
        },
      ],
    });

    await expect(pylon.setup()).rejects.toMatchObject({
      code: "subscriptions_bus_not_configured",
    });
  });

  test("should boot untouched when no subscriptions are declared", async () => {
    const pylon = createPylon({ bus: createBus() });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });

  test("should boot untouched when subscriptions is an empty array and there is no bus", async () => {
    const pylon = createPylon({ subscriptions: [] });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });
});
