import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { createMockRabbitMessageBus, IRabbitSource, RabbitSource } from "@lindorm/rabbit";
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
import { TestEventThrows } from "../__fixtures__/modules/events/TestEventThrows";
import { ViewNotCreatedError } from "../errors";
import { MessageBus, ViewStore } from "../infrastructure";
import {
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
  IViewDomain,
  IViewModel,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { AggregateIdentifier, ViewIdentifier } from "../types";
import { ViewDomain } from "./ViewDomain";

describe("ViewDomain", () => {
  const logger = createMockLogger();

  let domain: IViewDomain;
  let commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let store: any;

  beforeEach(async () => {
    commandBus = createMockRabbitMessageBus(HermesCommand);
    errorBus = createMockRabbitMessageBus(HermesError);
    eventBus = createMockRabbitMessageBus(HermesEvent);
    store = {
      load: jest.fn().mockImplementation(async (identifier: ViewIdentifier) => ({
        ...identifier,
      })),
      loadCausations: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation(async (view: IViewModel, causation: IHermesMessage) => ({
          ...view.toJSON(),
          revision: view.revision + 1,
          processedCausationIds: [...view.processedCausationIds, causation.id],
        })),
      saveCausations: jest.fn().mockImplementation(async (view: IViewModel) => ({
        ...view.toJSON(),
        revision: view.revision + 1,
        processedCausationIds: [],
      })),
    };

    domain = new ViewDomain({
      commandBus,
      errorBus,
      eventBus,
      logger,
      registry: createTestRegistry(),
      store,
    });

    await domain.registerHandlers();
  });

  test("should register event handler", async () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.view.hermes.test_aggregate.test_event_create.hermes.test_mongo_view",
      topic: "hermes.test_aggregate.test_event_create",
    });
  });

  test("should handle event", async () => {
    const aggregate = createTestAggregateIdentifier();
    const event = createTestEvent(new TestEventCreate("create"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestViewIdentifier()),
    ).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith(
      {
        id: event.aggregate.id,
        namespace: "hermes",
        name: "test_mongo_view",
      },
      "mongo",
    );

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "test_mongo_view",
        namespace: "hermes",
        processedCausationIds: [],
        destroyed: false,
        revision: 0,
        state: { create: "create" },
      }),
      event,
      "mongo",
    );
  });

  test("should skip handler when last causation matches event id", async () => {
    const aggregate = createTestAggregateIdentifier();
    const event = createTestEvent(new TestEventCreate("create"), { aggregate });

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      processedCausationIds: [event.id],
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestViewIdentifier()),
    ).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
  });

  test("should dispatch error on destroyed view", async () => {
    const event = createTestEvent(new TestEventMergeState("merge-state"));

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      destroyed: true,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestViewIdentifier()),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "view_destroyed_error",
        data: {
          error: expect.objectContaining({ name: "ViewDestroyedError" }),
          event: expect.objectContaining({
            input: "merge-state",
          }),
          message: event,
          view: {
            id: expect.any(String),
            name: "test_mongo_view",
            namespace: "hermes",
          },
        },
      }),
    );
  });

  test("should throw on not created view", async () => {
    const event = createTestEvent(new TestEventDestroy("destroy"));

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 0,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestViewIdentifier()),
    ).rejects.toThrow(ViewNotCreatedError);

    expect(errorBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created view", async () => {
    const event = createTestEvent(new TestEventCreate("create"));

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestViewIdentifier()),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "view_already_created_error",
        data: {
          error: expect.objectContaining({ name: "ViewAlreadyCreatedError" }),
          event: expect.objectContaining({
            input: "create",
          }),
          message: event,
          view: {
            id: expect.any(String),
            name: "test_mongo_view",
            namespace: "hermes",
          },
        },
      }),
    );
  });

  test("should throw from event handler", async () => {
    const event = createTestEvent(new TestEventThrows("throws"));

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestViewIdentifier()),
    ).rejects.toThrow(new Error("throws"));

    expect(errorBus.publish).not.toHaveBeenCalled();
  });
});

describe("ViewDomain (integration)", () => {
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
        namespace: namespace,
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
