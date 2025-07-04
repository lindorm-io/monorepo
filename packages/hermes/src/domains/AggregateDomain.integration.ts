import { createMockLogger } from "@lindorm/logger";
import { MessageKit } from "@lindorm/message";
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
  TEST_AGGREGATE_COMMAND_HANDLER_ENCRYPT,
  TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
} from "../__fixtures__/aggregate-command-handler";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_ENCRYPT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
} from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_COMMAND_CREATE,
  TEST_HERMES_COMMAND_DESTROY,
  TEST_HERMES_COMMAND_DESTROY_NEXT,
  TEST_HERMES_COMMAND_ENCRYPT,
  TEST_HERMES_COMMAND_MERGE_STATE,
} from "../__fixtures__/hermes-command";
import { EncryptionStore, EventStore, MessageBus } from "../infrastructure";
import {
  IAggregateDomain,
  IEventStore,
  IHermesAggregateCommandHandler,
  IHermesAggregateEventHandler,
  IHermesEncryptionStore,
  IHermesMessageBus,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { AggregateDomain } from "./AggregateDomain";

describe("AggregateDomain", () => {
  const commandKit = new MessageKit({ Message: HermesCommand });

  const logger = createMockLogger();

  let commandHandlers: Array<IHermesAggregateCommandHandler>;
  let domain: IAggregateDomain;
  let encryptionStore: IHermesEncryptionStore;
  let eventHandlers: Array<IHermesAggregateEventHandler>;
  let eventStore: IEventStore;
  let commandBus: IHermesMessageBus<HermesCommand>;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent>;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoAggregateDomain",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });
    await mongo.setup();

    rabbit = new RabbitSource({
      logger,
      url: "amqp://localhost:5672",
    });
    await rabbit.setup();

    commandBus = new MessageBus({ Message: HermesCommand, rabbit, logger });
    errorBus = new MessageBus({ Message: HermesError, rabbit, logger });
    eventBus = new MessageBus({ Message: HermesEvent, rabbit, logger });

    encryptionStore = new EncryptionStore({ mongo, logger });
    eventStore = new EventStore({ mongo, logger });

    domain = new AggregateDomain({
      commandBus,
      errorBus,
      eventBus,
      encryptionStore,
      eventStore,
      logger,
    });

    commandHandlers = [
      TEST_AGGREGATE_COMMAND_HANDLER,
      TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
      TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
      TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
      TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
      TEST_AGGREGATE_COMMAND_HANDLER_ENCRYPT,
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
      TEST_AGGREGATE_EVENT_HANDLER_ENCRYPT,
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

    const commandCreate = commandKit.create({ ...TEST_HERMES_COMMAND_CREATE, aggregate });

    const commandMergeState = commandKit.create({
      ...TEST_HERMES_COMMAND_MERGE_STATE,
      aggregate,
    });

    const commandEncrypt = commandKit.create({
      ...TEST_HERMES_COMMAND_ENCRYPT,
      aggregate,
    });

    const commandDestroyNext = commandKit.create({
      ...TEST_HERMES_COMMAND_DESTROY_NEXT,
      aggregate,
    });

    const commandDestroy = commandKit.create({
      ...TEST_HERMES_COMMAND_DESTROY,
      aggregate,
    });

    await expect(commandBus.publish(commandCreate)).resolves.toBeUndefined();
    await sleep(250);

    await expect(commandBus.publish(commandMergeState)).resolves.toBeUndefined();
    await sleep(250);

    await expect(commandBus.publish(commandEncrypt)).resolves.toBeUndefined();
    await sleep(250);

    await expect(commandBus.publish(commandDestroyNext)).resolves.toBeUndefined();
    await sleep(250);

    await expect(commandBus.publish(commandDestroy)).resolves.toBeUndefined();
    await sleep(250);

    await expect(domain.inspect(aggregate)).resolves.toEqual(
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
            causationId: commandEncrypt.id,
            correlationId: commandEncrypt.correlationId,
            name: "hermes_event_encrypt",
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
        numberOfLoadedEvents: 5,
        state: {
          created: true,
          encrypted: {
            encryptedData: {
              commandData: true,
            },
          },
          merge: {
            dataFromCommand: {
              commandData: true,
            },
          },
        },
      }),
    );

    await expect(encryptionStore.inspect(aggregate)).resolves.toEqual({
      id: aggregate.id,
      name: "aggregate_name",
      context: "default",
      key_algorithm: "dir",
      key_curve: null,
      key_encryption: null,
      key_id: expect.any(String),
      key_type: "oct",
      private_key: expect.any(String),
      public_key: expect.any(String),
      created_at: expect.any(Date),
    });

    await expect(eventStore.find(aggregate)).resolves.toEqual([
      expect.objectContaining({
        causation_id: commandCreate.id,
        correlation_id: commandCreate.correlationId,
        event_name: "hermes_event_create",
      }),
      expect.objectContaining({
        causation_id: commandMergeState.id,
        correlation_id: commandMergeState.correlationId,
        event_name: "hermes_event_merge_state",
      }),
      expect.objectContaining({
        causation_id: commandEncrypt.id,
        correlation_id: commandEncrypt.correlationId,
        event_name: "hermes_event_encrypt",
        data: {
          algorithm: "dir",
          authTag: expect.any(String),
          content: expect.any(String),
          contentType: "application/octet-stream",
          encryption: "A256GCM",
          initialisationVector: expect.any(String),
          keyId: expect.any(String),
          version: expect.any(Number),
        },
      }),
      expect.objectContaining({
        causation_id: commandDestroyNext.id,
        correlation_id: commandDestroyNext.correlationId,
        event_name: "hermes_event_destroy_next",
      }),
      expect.objectContaining({
        causation_id: commandDestroy.id,
        correlation_id: commandDestroy.correlationId,
        event_name: "hermes_event_destroy",
      }),
    ]);
  }, 30000);
});
