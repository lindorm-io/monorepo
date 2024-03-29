import { AmqpConnection, ISubscription } from "@lindorm-io/amqp";
import { Command, DomainEvent } from "../../message";
import { AmqpMessageBus } from "./AmqpMessageBus";
import { createMockLogger } from "@lindorm-io/core-logger";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

describe("AmqpMessageBus", () => {
  const logger = createMockLogger();

  let connection: AmqpConnection;
  let messageBus: AmqpMessageBus;
  let commandSub: ISubscription;
  let domainEventSub: ISubscription;

  beforeAll(async () => {
    connection = new AmqpConnection(
      {
        hostname: "localhost",
        port: 5002,
        connectInterval: 500,
        connectTimeout: 50000,
      },
      logger,
    );
    await connection.connect();

    messageBus = new AmqpMessageBus(connection, logger);

    commandSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "command-queue",
      topic: "context.aggregate.command_name",
    };

    domainEventSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "domain-event-queue",
      topic: "context.aggregate.domain_event_name",
    };

    await messageBus.subscribe([commandSub, domainEventSub]);

    await sleep(1000);
  }, 60000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should publish command", async () => {
    const command = new Command({
      name: "command_name",
      data: { content: "command-data" },
      aggregate: {
        id: randomUUID(),
        name: "aggregate",
        context: "context",
      },
      metadata: {
        origin: "test",
      },
    });

    await expect(messageBus.publish([command])).resolves.toBeUndefined();

    await sleep(1000);

    expect(commandSub.callback).toHaveBeenCalledTimes(1);
    expect(commandSub.callback).toHaveBeenCalledWith(command);
  }, 15000);

  test("should publish domain event", async () => {
    const command = new Command({
      name: "command_name",
      data: { content: "command-data" },
      aggregate: {
        id: randomUUID(),
        name: "aggregate",
        context: "context",
      },
      metadata: {
        origin: "test",
      },
    });

    const domainEvent = new DomainEvent(
      {
        name: "domain_event_name",
        data: { content: "domain-event-data" },
        aggregate: {
          id: randomUUID(),
          name: "aggregate",
          context: "context",
        },
        metadata: {
          origin: "test",
        },
      },
      command,
    );

    await expect(messageBus.publish([domainEvent])).resolves.toBeUndefined();

    await sleep(500);

    expect(domainEventSub.callback).toHaveBeenCalledTimes(1);
    expect(domainEventSub.callback).toHaveBeenCalledWith(domainEvent);
  }, 15000);
});
