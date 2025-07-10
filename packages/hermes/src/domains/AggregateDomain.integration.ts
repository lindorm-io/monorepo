import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { createTestCommand } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { TestCommandCreate } from "../__fixtures__/modules/commands/TestCommandCreate";
import { TestCommandDestroy } from "../__fixtures__/modules/commands/TestCommandDestroy";
import { TestCommandDestroyNext } from "../__fixtures__/modules/commands/TestCommandDestroyNext";
import { TestCommandEncrypt } from "../__fixtures__/modules/commands/TestCommandEncrypt";
import { TestCommandMergeState } from "../__fixtures__/modules/commands/TestCommandMergeState";
import { EncryptionStore, EventStore, MessageBus } from "../infrastructure";
import {
  IAggregateDomain,
  IEventStore,
  IHermesEncryptionStore,
  IHermesMessageBus,
  IHermesRegistry,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { AggregateIdentifier } from "../types";
import { AggregateDomain } from "./AggregateDomain";

describe("AggregateDomain", () => {
  const namespace = "agg_dom";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  let domain: IAggregateDomain;
  let encryptionStore: IHermesEncryptionStore;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let eventStore: IEventStore;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let registry: IHermesRegistry;

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

    aggregate = createTestAggregateIdentifier(namespace);

    registry = createTestRegistry(namespace);

    domain = new AggregateDomain({
      commandBus,
      encryptionStore,
      errorBus,
      eventBus,
      eventStore,
      logger,
      registry,
    });

    await domain.registerHandlers();
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published commands", async () => {
    const commandCreate = createTestCommand(new TestCommandCreate("create"), {
      aggregate,
    });

    const commandMergeState = createTestCommand(
      new TestCommandMergeState("merge-state"),
      { aggregate },
    );

    const commandEncrypt = createTestCommand(new TestCommandEncrypt("encrypt"), {
      aggregate,
    });

    const commandDestroyNext = createTestCommand(
      new TestCommandDestroyNext("destroy-next"),
      { aggregate },
    );

    const commandDestroy = createTestCommand(new TestCommandDestroy("destroy"), {
      aggregate,
    });

    await expect(commandBus.publish(commandCreate)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandMergeState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandEncrypt)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandDestroyNext)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandDestroy)).resolves.toBeUndefined();
    await sleep(500);

    await expect(domain.inspect(aggregate)).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "test_aggregate",
        namespace: namespace,
        destroyed: true,
        events: [
          expect.objectContaining({
            causationId: commandCreate.id,
            correlationId: commandCreate.correlationId,
            name: "test_event_create",
          }),
          expect.objectContaining({
            causationId: commandMergeState.id,
            correlationId: commandMergeState.correlationId,
            name: "test_event_merge_state",
          }),
          expect.objectContaining({
            causationId: commandEncrypt.id,
            correlationId: commandEncrypt.correlationId,
            name: "test_event_encrypt",
          }),
          expect.objectContaining({
            causationId: commandDestroyNext.id,
            correlationId: commandDestroyNext.correlationId,
            name: "test_event_destroy_next",
          }),
          expect.objectContaining({
            causationId: commandDestroy.id,
            correlationId: commandDestroy.correlationId,
            name: "test_event_destroy",
          }),
        ],
        numberOfLoadedEvents: 5,
        state: {
          create: "create",
          destroy: "destroy",
          destroyNext: "destroy next",
          encrypt: "encrypt",
          mergeState: "merge state",
        },
      }),
    );

    await expect(encryptionStore.inspect(aggregate)).resolves.toEqual({
      id: aggregate.id,
      name: "test_aggregate",
      namespace: namespace,
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
        event_name: "test_event_create",
      }),
      expect.objectContaining({
        causation_id: commandMergeState.id,
        correlation_id: commandMergeState.correlationId,
        event_name: "test_event_merge_state",
      }),
      expect.objectContaining({
        causation_id: commandEncrypt.id,
        correlation_id: commandEncrypt.correlationId,
        event_name: "test_event_encrypt",
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
        event_name: "test_event_destroy_next",
      }),
      expect.objectContaining({
        causation_id: commandDestroy.id,
        correlation_id: commandDestroy.correlationId,
        event_name: "test_event_destroy",
      }),
    ]);
  }, 30000);
});
