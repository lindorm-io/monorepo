import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { createTestSagaIdentifier } from "../__fixtures__/create-test-saga-identifier";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventSetState } from "../__fixtures__/modules/events/TestEventSetState";
import { MessageBus, SagaStore } from "../infrastructure";
import { IHermesRegistry } from "../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";
import { AggregateIdentifier, SagaIdentifier } from "../types";
import { SagaDomain } from "./SagaDomain";

describe("SagaDomain", () => {
  const namespace = "sag_dom";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let commandBus: MessageBus<HermesCommand<Dict>>;
  let domain: SagaDomain;
  let errorBus: MessageBus<HermesError>;
  let eventBus: MessageBus<HermesEvent<Dict>>;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let registry: IHermesRegistry;
  let saga: SagaIdentifier;
  let store: SagaStore;
  let timeoutBus: MessageBus<HermesTimeout>;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoSagaDomain",
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
    timeoutBus = new MessageBus({ Message: HermesTimeout, rabbit, logger });

    store = new SagaStore({ mongo, logger });

    aggregate = createTestAggregateIdentifier(namespace);
    saga = { ...createTestSagaIdentifier(namespace), id: aggregate.id };

    registry = createTestRegistry(namespace);

    domain = new SagaDomain({
      commandBus,
      errorBus,
      eventBus,
      logger,
      registry,
      store,
      timeoutBus,
    });

    await domain.registerHandlers();
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published events", async () => {
    const eventCreate = createTestEvent(new TestEventCreate("create"), {
      aggregate,
    });
    const eventMergeState = createTestEvent(new TestEventMergeState("merge-state"), {
      aggregate,
    });
    const eventSetState = createTestEvent(new TestEventSetState("set-state"), {
      aggregate,
    });
    const eventDestroy = createTestEvent(new TestEventDestroy("destroy"), {
      aggregate,
    });

    await expect(eventBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(500);

    await expect(store.load(saga)).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "test_saga",
        namespace: namespace,
        processedCausationIds: [],
        destroyed: true,
        messagesToDispatch: [],
        revision: 8,
        state: {
          create: "create",
          destroy: "destroy",
          mergeState: "merge-state",
          setState: "set-state",
        },
      }),
    );
  }, 30000);
});
