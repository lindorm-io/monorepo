import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { createTestViewIdentifier } from "../__fixtures__/create-test-view-identifier";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventSetState } from "../__fixtures__/modules/events/TestEventSetState";
import { MessageBus, ViewStore } from "../infrastructure";
import { IHermesRegistry } from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { AggregateIdentifier, ViewIdentifier } from "../types";
import { ViewDomain } from "./ViewDomain";

describe("ViewDomain", () => {
  const namespace = "vie_dom";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let commandBus: MessageBus<HermesCommand<Dict>>;
  let domain: ViewDomain;
  let errorBus: MessageBus<HermesError>;
  let eventBus: MessageBus<HermesEvent<Dict>>;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let registry: IHermesRegistry;
  let store: ViewStore;
  let view: ViewIdentifier;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoViewDomain",
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

    store = new ViewStore({ mongo, logger });

    aggregate = createTestAggregateIdentifier(namespace);
    view = { ...createTestViewIdentifier(namespace), id: aggregate.id };

    registry = createTestRegistry(namespace);

    domain = new ViewDomain({
      commandBus,
      errorBus,
      eventBus,
      logger,
      registry,
      store,
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
      timestamp: new Date("2022-01-01T08:00:00.000Z"),
    });
    const eventMergeState = createTestEvent(new TestEventMergeState("merge-state"), {
      aggregate,
      timestamp: new Date("2022-01-02T08:00:00.000Z"),
    });
    const eventSetState = createTestEvent(new TestEventSetState("set-state"), {
      aggregate,
      timestamp: new Date("2022-01-03T08:00:00.000Z"),
    });
    const eventDestroy = createTestEvent(new TestEventDestroy("destroy"), {
      aggregate,
      timestamp: new Date("2022-01-04T08:00:00.000Z"),
    });

    await expect(eventBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(500);

    await expect(store.load(view, "mongo")).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "test_mongo_view",
        context: namespace,
        destroyed: true,
        meta: {
          create: {
            destroyed: false,
            timestamp: new Date("2022-01-01T08:00:00.000Z"),
            value: "create",
          },
          destroy: {
            destroyed: false,
            timestamp: new Date("2022-01-04T08:00:00.000Z"),
            value: "destroy",
          },
          mergeState: {
            destroyed: false,
            timestamp: new Date("2022-01-02T08:00:00.000Z"),
            value: "merge-state",
          },
          setState: {
            destroyed: false,
            timestamp: new Date("2022-01-03T08:00:00.000Z"),
            value: "set-state",
          },
        },
        processedCausationIds: [],
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
