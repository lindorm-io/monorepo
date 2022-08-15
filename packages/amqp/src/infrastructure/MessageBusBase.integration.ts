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

  beforeAll(async () => {
    connection = new AmqpConnection(
      {
        hostname: "localhost",
        port: 5672,
        connectInterval: 500,
        connectTimeout: 30000,
      },
      logger,
    );

    await connection.connect();

    messageBus = new TestMessageBus({ connection, logger });
  }, 60000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should subscribe and publish", async () => {
    const subscription1: ISubscription = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-1",
      topic: "message-route-1",
    };

    const message1: IMessage = {
      id: randomUUID(),
      name: "message-name-1",
      data: {},
      delay: 0,
      mandatory: true,
      topic: "message-route-1",
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
    const subscription2: ISubscription = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-2",
      topic: "message-route-2",
    };

    const subscription3: ISubscription = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-3",
      topic: "message-route-3",
    };

    const message2: IMessage = {
      id: randomUUID(),
      name: "message-name-2",
      data: {},
      delay: 0,
      mandatory: true,
      topic: "message-route-2",
      timestamp: new Date(),
      type: "type",
    };

    const message3: IMessage = {
      id: randomUUID(),
      name: "message-name-3",
      data: {},
      delay: 0,
      mandatory: true,
      topic: "message-route-3",
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

  test("should subscribe and publish with delay", async () => {
    const subscription4: ISubscription = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-4",
      topic: "message-route-4",
    };

    const message4: IMessage = {
      id: randomUUID(),
      name: "message-name-4",
      data: {},
      delay: 1000,
      mandatory: true,
      topic: "message-route-4",
      timestamp: new Date(),
      type: "type",
    };

    await expect(messageBus.subscribe(subscription4)).resolves.toBeUndefined();
    await sleep(1000);

    await expect(messageBus.publish(message4)).resolves.toBeUndefined();
    await sleep(3000);

    expect(subscription4.callback).toHaveBeenCalledWith(message4);
  }, 15000);

  test("should unsubscribe", async () => {
    const subscription5: ISubscription = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "subscription-queue-5",
      topic: "message-route-5",
    };

    const message5: IMessage = {
      id: randomUUID(),
      name: "message-name-5",
      data: {},
      delay: 0,
      mandatory: true,
      topic: "message-route-5",
      timestamp: new Date(),
      type: "type",
    };

    await expect(messageBus.subscribe(subscription5)).resolves.toBeUndefined();
    await sleep(500);

    await expect(messageBus.unsubscribe(subscription5)).resolves.toBeUndefined();
    await sleep(500);

    await expect(messageBus.publish(message5)).resolves.toBeUndefined();
    await sleep(3000);

    expect(subscription5.callback).not.toHaveBeenCalledWith(message5);

    await expect(messageBus.subscribe(subscription5)).resolves.toBeUndefined();
    await sleep(500);

    expect(subscription5.callback).toHaveBeenCalledWith(message5);
  }, 15000);
});
