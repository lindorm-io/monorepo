import { Aggregate } from "../model";
import { AggregateDomain } from "./AggregateDomain";
import { AggregateIdentifier, IAggregateDomain } from "../types";
import { Command, DomainEvent } from "../message";
import { LindormError } from "@lindorm-io/errors";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockMessageBus, IMessageBus } from "@lindorm-io/amqp";
import { randomUUID } from "crypto";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CommandSchemaValidationError,
  HandlerNotRegisteredError,
} from "../error";
import {
  TEST_COMMAND_CREATE,
  TEST_COMMAND_MERGE_STATE,
  TEST_COMMAND_THROWS,
} from "../fixtures/command.fixture";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_MERGE_STATE,
} from "../fixtures/domain-event.fixture";
import {
  TEST_AGGREGATE_COMMAND_HANDLER,
  TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE,
  TEST_AGGREGATE_COMMAND_HANDLER_THROWS,
} from "../fixtures/aggregate-command-handler.fixture";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../fixtures/aggregate-event-handler.fixture";

describe("AggregateDomain", () => {
  const logger = createMockLogger();
  const commandHandlers = [
    TEST_AGGREGATE_COMMAND_HANDLER,
    TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
    TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
    TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
    TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
    TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE,
    TEST_AGGREGATE_COMMAND_HANDLER_THROWS,
  ];
  const eventHandlers = [
    TEST_AGGREGATE_EVENT_HANDLER,
    TEST_AGGREGATE_EVENT_HANDLER_CREATE,
    TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
    TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
    TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
    TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
    TEST_AGGREGATE_EVENT_HANDLER_THROWS,
  ];

  let domain: IAggregateDomain;
  let messageBus: IMessageBus;
  let store: any;

  beforeEach(async () => {
    messageBus = createMockMessageBus();
    store = { save: jest.fn(), load: jest.fn() };
    domain = new AggregateDomain({ messageBus, store }, logger);

    for (const handler of commandHandlers) {
      await domain.registerCommandHandler(handler);
    }

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    store.load.mockImplementation(
      async (a: AggregateIdentifier) => new Aggregate({ ...a, eventHandlers }, logger),
    );
    store.save.mockImplementation(async (aggregate: Aggregate) => aggregate.events);
  });

  test("should register command handler", async () => {
    messageBus = createMockMessageBus();
    domain = new AggregateDomain({ messageBus, store }, logger);

    await expect(
      domain.registerCommandHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.aggregate.default.aggregate_name.command_default",
      topic: "default.aggregate_name.command_default",
    });
  });

  test("should throw on existing command handler", async () => {
    domain = new AggregateDomain({ messageBus, store }, logger);

    await domain.registerCommandHandler(TEST_AGGREGATE_COMMAND_HANDLER);

    await expect(domain.registerCommandHandler(TEST_AGGREGATE_COMMAND_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid command handler", async () => {
    domain = new AggregateDomain({ messageBus, store }, logger);

    // @ts-ignore // private domain.handleCommand
    await expect(domain.registerCommandHandler(TEST_AGGREGATE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should register event handler", async () => {
    domain = new AggregateDomain({ messageBus, store }, logger);

    await expect(
      domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).resolves.toBeUndefined();
  });

  test("should throw on existing event handler", async () => {
    domain = new AggregateDomain({ messageBus, store }, logger);

    await domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new AggregateDomain({ messageBus, store }, logger);

    // @ts-ignore // private domain.handleCommand
    await expect(domain.registerEventHandler(TEST_AGGREGATE_COMMAND_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should handle command", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command)).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith(
      aggregate,
      expect.arrayContaining([TEST_AGGREGATE_EVENT_HANDLER_CREATE]),
    );

    expect(TEST_AGGREGATE_COMMAND_HANDLER_CREATE.handler).toHaveBeenCalledTimes(1);

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ...aggregate,
        destroyed: false,
        numberOfLoadedEvents: 0,
        state: { created: true },
        events: [
          expect.objectContaining({
            id: expect.any(String),
            name: "domain_event_create",
            aggregate,
            causationId: command.id,
            correlationId: command.correlationId,
            data: { dataFromCommand: { commandData: true } },
            delay: 0,
            mandatory: false,
            topic: "default.aggregate_name.domain_event_create",
            timestamp: expect.any(Date),
            type: "domain_event",
          }),
        ],
      }),
      command,
    );

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: "domain_event_create",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { dataFromCommand: { commandData: true } },
        delay: 0,
        mandatory: false,
        topic: "default.aggregate_name.domain_event_create",
        timestamp: expect.any(Date),
        type: "domain_event",
      }),
    ]);
  });

  test("should skip handler when last causation matches command id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command1 = new Command({ ...TEST_COMMAND_CREATE, aggregate });
    const event1 = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate }, command1);

    const command2 = new Command({ ...TEST_COMMAND_MERGE_STATE, aggregate });
    const event2 = new DomainEvent({ ...TEST_DOMAIN_EVENT_MERGE_STATE, aggregate }, command2);

    store.load.mockImplementation(async (a: AggregateIdentifier) => {
      const agg = new Aggregate({ ...a, eventHandlers }, logger);
      await agg.load(event1);
      await agg.load(event2);
      return agg;
    });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command2)).resolves.toBeUndefined();

    expect(TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE.handler).not.toHaveBeenCalled();
  });

  test("should throw on missing command handler", async () => {
    domain = new AggregateDomain({ messageBus, store }, logger);

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(new Command(TEST_COMMAND_CREATE))).rejects.toThrow(
      HandlerNotRegisteredError,
    );
  });

  test("should throw on invalid command data", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new Command({
      ...TEST_COMMAND_CREATE,
      aggregate,
      data: {},
    });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command)).rejects.toThrow(CommandSchemaValidationError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "command_schema_validation_error",
        data: {
          error: expect.any(CommandSchemaValidationError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw on destroyed aggregate", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    store.load.mockImplementation(async (a: AggregateIdentifier) => {
      const agg = new Aggregate({ ...a, eventHandlers }, logger);
      await agg.load(new DomainEvent(TEST_DOMAIN_EVENT_DESTROY));
      return agg;
    });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command)).rejects.toThrow(AggregateDestroyedError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "aggregate_destroyed_error",
        data: {
          error: expect.any(AggregateDestroyedError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw on not created aggregate", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new Command({ ...TEST_COMMAND_MERGE_STATE, aggregate });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command)).rejects.toThrow(AggregateNotCreatedError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "aggregate_not_created_error",
        data: {
          error: expect.any(AggregateNotCreatedError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw on already created aggregate", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    store.load.mockImplementation(async (a: AggregateIdentifier) => {
      const agg = new Aggregate({ ...a, eventHandlers }, logger);
      await agg.load(new DomainEvent(TEST_DOMAIN_EVENT_CREATE));
      return agg;
    });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command)).rejects.toThrow(AggregateAlreadyCreatedError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "aggregate_already_created_error",
        data: {
          error: expect.any(AggregateAlreadyCreatedError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw from command handler", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new Command({ ...TEST_COMMAND_THROWS, aggregate });

    store.load.mockImplementation(async (a: AggregateIdentifier) => {
      const agg = new Aggregate({ ...a, eventHandlers }, logger);
      await agg.load(new DomainEvent(TEST_DOMAIN_EVENT_CREATE));
      return agg;
    });

    // @ts-ignore // private domain.handleCommand
    await expect(domain.handleCommand(command)).rejects.toThrow(new Error("throw"));
  });
});
