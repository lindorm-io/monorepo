import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import {
  TEST_AGGREGATE_COMMAND_HANDLER,
  TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
} from "../__fixtures__/aggregate-command-handler";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
} from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_COMMAND_CREATE,
  TEST_HERMES_COMMAND_DESTROY,
  TEST_HERMES_COMMAND_DESTROY_NEXT,
  TEST_HERMES_COMMAND_MERGE_STATE,
} from "../__fixtures__/hermes-command";
import { HermesAggregateCommandHandler, HermesAggregateEventHandler } from "../handlers";
import { EventStore, MessageBus } from "../infrastructure";
import { HermesCommand } from "../messages";
import { AggregateDomain } from "./AggregateDomain";

describe("AggregateDomain", () => {
  const logger = createMockLogger();

  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let commandHandlers: Array<HermesAggregateCommandHandler>;
  let domain: AggregateDomain;
  let eventHandlers: Array<HermesAggregateEventHandler>;
  let messageBus: MessageBus;
  let store: EventStore;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoAggregateDomain",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });
    await mongo.setup();

    rabbit = new RabbitSource({
      logger,
      messages: [],
      url: "amqp://localhost:5672",
    });
    await rabbit.setup();

    messageBus = new MessageBus({ rabbit, logger });
    store = new EventStore({ mongo, logger });
    domain = new AggregateDomain({ messageBus, store, logger });

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
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published commands", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };

    const commandCreate = new HermesCommand({ ...TEST_HERMES_COMMAND_CREATE, aggregate });
    const commandMergeState = new HermesCommand({
      ...TEST_HERMES_COMMAND_MERGE_STATE,
      aggregate,
    });
    const commandDestroyNext = new HermesCommand({
      ...TEST_HERMES_COMMAND_DESTROY_NEXT,
      aggregate,
    });
    const commandDestroy = new HermesCommand({
      ...TEST_HERMES_COMMAND_DESTROY,
      aggregate,
    });

    await expect(messageBus.publish(commandCreate)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(commandMergeState)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(commandDestroyNext)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(commandDestroy)).resolves.toBeUndefined();
    await sleep(50);

    await expect(store.load(aggregate, eventHandlers)).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        destroyed: true,
        events: [
          expect.objectContaining({
            causationId: commandCreate.id,
            correlationId: commandCreate.correlationId,
            name: "hermes_event_create",
          }),
          expect.objectContaining({
            causationId: commandMergeState.id,
            correlationId: commandMergeState.correlationId,
            name: "hermes_event_merge_state",
          }),
          expect.objectContaining({
            causationId: commandDestroyNext.id,
            correlationId: commandDestroyNext.correlationId,
            name: "hermes_event_destroy_next",
          }),
          expect.objectContaining({
            causationId: commandDestroy.id,
            correlationId: commandDestroy.correlationId,
            name: "hermes_event_destroy",
          }),
        ],
        numberOfLoadedEvents: 4,
        state: {
          created: true,
          merge: {
            dataFromCommand: {
              commandData: true,
            },
          },
        },
      }),
    );
  }, 30000);
});
