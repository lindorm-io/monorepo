import { AmqpConnection } from "../connection";
import { IMessage, ISubscription } from "../types";
import { TestMessageBus } from "../mocks";
import { createMockLogger } from "@lindorm-io/core-logger";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

const mockAmqplib = require("mock-amqplib");

describe("MessageBusBase", () => {
  const logger = createMockLogger();

  let connection: AmqpConnection;
  let messageBus: TestMessageBus;

  beforeAll(async () => {
    connection = new AmqpConnection(
      {
        hostname: "localhost",
        port: 5001,
        connectInterval: 500,
        connectTimeout: 50000,
        custom: mockAmqplib,
      },
      logger,
    );

    await connection.connect();

    messageBus = new TestMessageBus(connection, logger);
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
});
