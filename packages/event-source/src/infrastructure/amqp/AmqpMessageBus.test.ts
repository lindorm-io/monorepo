import { AmqpConnection, ISubscription } from "@lindorm-io/amqp";
import { AmqpMessageBus } from "./AmqpMessageBus";
import { Command, DomainEvent } from "../../message";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

const mock = require("mock-amqplib");

describe("MessageBus", () => {
  const logger = createMockLogger();

  let connection: AmqpConnection;
  let messageBus: AmqpMessageBus;
  let commandSub: ISubscription;
  let domainEventSub: ISubscription;

  beforeAll(async () => {
    connection = new AmqpConnection(
      {
        hostname: "localhost",
        port: 5671,
        connectInterval: 500,
        connectTimeout: 50000,
        custom: mock,
      },
      logger,
    );

    await connection.connect();

    messageBus = new AmqpMessageBus(connection, logger);

    commandSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "command-queue",
      topic: "context.aggregate.commandName",
    };

    domainEventSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "domain-event-queue",
      topic: "context.aggregate.domainEventName",
    };

    await messageBus.subscribe([commandSub, domainEventSub]);
    await sleep(2000);
  }, 60000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should publish command", async () => {
    const command = new Command({
      name: "commandName",
      data: { content: "command-data" },
      aggregate: {
        id: randomUUID(),
        name: "aggregate",
        context: "context",
      },
      origin: "test",
    });

    await expect(messageBus.publish([command])).resolves.toBeUndefined();
    await sleep(2000);

    expect(commandSub.callback).toHaveBeenCalledTimes(1);
    expect(commandSub.callback).toHaveBeenCalledWith(command);
  }, 15000);

  test("should publish domain event", async () => {
    const command = new Command({
      name: "commandName",
      data: { content: "command-data" },
      aggregate: {
        id: randomUUID(),
        name: "aggregate",
        context: "context",
      },
      origin: "test",
    });

    const domainEvent = new DomainEvent(
      {
        name: "domainEventName",
        data: { content: "domain-event-data" },
        aggregate: {
          id: randomUUID(),
          name: "aggregate",
          context: "context",
        },
        origin: "test",
      },
      command,
    );

    await expect(messageBus.publish([domainEvent])).resolves.toBeUndefined();
    await sleep(2000);

    expect(domainEventSub.callback).toHaveBeenCalledTimes(1);
    expect(domainEventSub.callback).toHaveBeenCalledWith(domainEvent);
  }, 15000);
});
