import { AmqpConnection, ISubscription } from "@lindorm-io/amqp";
import { Command, DomainEvent } from "../message";
import { MessageBus } from "./MessageBus";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

describe("MessageBus", () => {
  const logger = createMockLogger();

  let connection: AmqpConnection;
  let messageBus: MessageBus;
  let commandSub: ISubscription;
  let domainEventSub: ISubscription;

  beforeAll(async () => {
    connection = new AmqpConnection({
      hostname: "localhost",
      logger,
      port: 5671,
      connectInterval: 500,
      connectTimeout: 50000,
    });

    await connection.connect();

    messageBus = new MessageBus({ connection, logger });

    commandSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "command-queue",
      routingKey: "context.aggregate.command_name",
    };

    domainEventSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "domain-event-queue",
      routingKey: "context.aggregate.domain_event_name",
    };

    await messageBus.subscribe([commandSub, domainEventSub]);
    await sleep(2000);
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
    });

    await expect(messageBus.publish([command])).resolves.toBeUndefined();
    await sleep(2000);

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
      },
      command,
    );

    await expect(messageBus.publish([domainEvent])).resolves.toBeUndefined();
    await sleep(2000);

    expect(domainEventSub.callback).toHaveBeenCalledTimes(1);
    expect(domainEventSub.callback).toHaveBeenCalledWith(domainEvent);
  }, 15000);
});
