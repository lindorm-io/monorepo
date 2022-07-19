import { AmqpConnection } from "../infrastructure";
import { IMessage } from "../types";
import { TestMessageBus } from "../mocks";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

describe("MessageBusBase", () => {
  const logger = createMockLogger();

  let connection: AmqpConnection;
  let message: IMessage;
  let messageBus: TestMessageBus;
  let subscription: any;

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

    message = {
      id: randomUUID(),
      delay: 0,
      mandatory: true,
      routingKey: "default",
      type: "type",
    };

    subscription = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "default-queue",
      routingKey: "default",
    };
  }, 60000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should subscribe and publish", async () => {
    await expect(messageBus.subscribe([subscription])).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish([message])).resolves.toBeUndefined();
    await sleep(2000);

    expect(subscription.callback).toHaveBeenCalledWith(message);
  }, 15000);
});
