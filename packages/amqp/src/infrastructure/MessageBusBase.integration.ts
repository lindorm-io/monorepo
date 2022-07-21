import { AmqpConnection } from "../connection";
import { IMessage, ISubscription } from "../types";
import { TestMessageBus } from "../mocks";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

describe("MessageBusBase", () => {
  const logger = createMockLogger();

  let connection: AmqpConnection;
  let messageBus: TestMessageBus;

  let subscription1: ISubscription;
  let subscription2: ISubscription;
  let subscription3: ISubscription;

  beforeAll(async () => {
    connection = new AmqpConnection({
      hostname: "localhost",
      logger,
      port: 5672,
      connectInterval: 500,
      connectTimeout: 50000,
    });

    await connection.connect();

    messageBus = new TestMessageBus({ connection, logger });

    subscription1 = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-1",
      routingKey: "message-route-1",
    };

    subscription2 = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-2",
      routingKey: "message-route-2",
    };

    subscription3 = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-3",
      routingKey: "message-route-3",
    };
  }, 60000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should subscribe and publish", async () => {
    const message1: IMessage = {
      id: randomUUID(),
      name: "message-name-1",
      data: {},
      delay: 0,
      mandatory: true,
      routingKey: "message-route-1",
      timestamp: new Date(),
      type: "type",
    };

    await expect(messageBus.subscribe(subscription1)).resolves.toBeUndefined();
    await sleep(1000);

    await expect(messageBus.publish(message1)).resolves.toBeUndefined();
    await sleep(1000);

    expect(subscription1.callback).toHaveBeenCalledWith(message1);
  }, 15000);

  test("should subscribe and publish multiple", async () => {
    const message2: IMessage = {
      id: randomUUID(),
      name: "message-name-2",
      data: {},
      delay: 0,
      mandatory: true,
      routingKey: "message-route-2",
      timestamp: new Date(),
      type: "type",
    };

    const message3: IMessage = {
      id: randomUUID(),
      name: "message-name-3",
      data: {},
      delay: 0,
      mandatory: true,
      routingKey: "message-route-3",
      timestamp: new Date(),
      type: "type",
    };

    await expect(messageBus.subscribe([subscription2, subscription3])).resolves.toBeUndefined();
    await sleep(1000);

    await expect(messageBus.publish([message2, message3])).resolves.toBeUndefined();
    await sleep(1000);

    expect(subscription2.callback).toHaveBeenCalledWith(message2);
    expect(subscription3.callback).toHaveBeenCalledWith(message3);
  }, 15000);
});
