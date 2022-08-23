import { Command, DomainEvent } from "../../message";
import { ISubscription } from "@lindorm-io/amqp";
import { MemoryMessageBus } from "./MemoryMessageBus";
import { randomUUID } from "crypto";

describe("AmqpMessageBus", () => {
  let commandSub: ISubscription;
  let domainEventSub: ISubscription;
  let messageBus: MemoryMessageBus;

  beforeAll(async () => {
    messageBus = new MemoryMessageBus();

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
      origin: "test",
    });

    await expect(messageBus.publish([command])).resolves.toBeUndefined();

    expect(commandSub.callback).toHaveBeenCalledTimes(1);
    expect(commandSub.callback).toHaveBeenCalledWith(command);
  });

  test("should publish domain event", async () => {
    const command = new Command({
      name: "command_name",
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
        name: "domain_event_name",
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

    expect(domainEventSub.callback).toHaveBeenCalledTimes(1);
    expect(domainEventSub.callback).toHaveBeenCalledWith(domainEvent);
  });
});
