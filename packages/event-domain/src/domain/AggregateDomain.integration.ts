import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { AggregateDomain } from "./AggregateDomain";
import { AmqpConnection } from "@lindorm-io/amqp";
import { Command } from "../message";
import { EventStore, MessageBus } from "../infrastructure";
import { MongoConnection } from "@lindorm-io/mongo";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  TEST_COMMAND_CREATE,
  TEST_COMMAND_DESTROY,
  TEST_COMMAND_DESTROY_NEXT,
  TEST_COMMAND_MERGE_STATE,
} from "../fixtures/command.fixture";
import {
  TEST_AGGREGATE_COMMAND_HANDLER,
  TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
  TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
} from "../fixtures/aggregate-command-handler.fixture";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
} from "../fixtures/aggregate-event-handler.fixture";

describe("AggregateDomain", () => {
  const logger = createMockLogger();

  let amqp: AmqpConnection;
  let commandHandlers: Array<AggregateCommandHandler>;
  let domain: AggregateDomain;
  let eventHandlers: Array<AggregateEventHandler>;
  let messageBus: MessageBus;
  let mongo: MongoConnection;
  let store: EventStore;

  beforeAll(async () => {
    amqp = new AmqpConnection({
      hostname: "localhost",
      logger,
      port: 5671,
      connectInterval: 500,
      connectTimeout: 30000,
    });

    mongo = new MongoConnection({
      host: "localhost",
      port: 27015,
      auth: { username: "root", password: "example" },
      logger,
      database: "db",
    });

    messageBus = new MessageBus({ connection: amqp, logger });
    store = new EventStore({ connection: mongo, logger });
    domain = new AggregateDomain({ logger, messageBus, store });

    commandHandlers = [
      TEST_AGGREGATE_COMMAND_HANDLER,
      TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
      TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
      TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
      TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
    ];

    for (const handler of commandHandlers) {
      await domain.registerCommandHandler(handler);
    }

    eventHandlers = [
      TEST_AGGREGATE_EVENT_HANDLER,
      TEST_AGGREGATE_EVENT_HANDLER_CREATE,
      TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
      TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
      TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
    ];

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    await Promise.all([amqp.connect(), mongo.connect()]);
  }, 30000);

  afterAll(async () => {
    await Promise.all([amqp.disconnect(), mongo.disconnect()]);
  });

  test("should handle multiple published commands", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };

    const commandCreate = new Command({ ...TEST_COMMAND_CREATE, aggregate });
    const commandMergeState = new Command({ ...TEST_COMMAND_MERGE_STATE, aggregate });
    const commandDestroyNext = new Command({ ...TEST_COMMAND_DESTROY_NEXT, aggregate });
    const commandDestroy = new Command({ ...TEST_COMMAND_DESTROY, aggregate });

    await expect(messageBus.publish(commandCreate)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(commandMergeState)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(commandDestroyNext)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(commandDestroy)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(store.load(aggregate, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregateName",
        context: "aggregateContext",
        destroyed: true,
        events: [
          expect.objectContaining({
            causationId: commandCreate.id,
            correlationId: commandCreate.correlationId,
            name: "domainEventCreate",
          }),
          expect.objectContaining({
            causationId: commandMergeState.id,
            correlationId: commandMergeState.correlationId,
            name: "domainEventMergeState",
          }),
          expect.objectContaining({
            causationId: commandDestroyNext.id,
            correlationId: commandDestroyNext.correlationId,
            name: "domainEventDestroyNext",
          }),
          expect.objectContaining({
            causationId: commandDestroy.id,
            correlationId: commandDestroy.correlationId,
            name: "domainEventDestroy",
          }),
        ],
        numberOfLoadedEvents: 4,
        state: {
          created: true,
          merge: {
            commandData: true,
          },
        },
      }),
    );
  }, 30000);
});
