import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { createTestViewIdentifier } from "../__fixtures__/create-test-view-identifier";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventThrows } from "../__fixtures__/modules/events/TestEventThrows";
import { ViewNotCreatedError } from "../errors";
import {
  IHermesMessage,
  IHermesMessageBus,
  IViewDomain,
  IViewModel,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { ViewIdentifier } from "../types";
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
        context: "hermes",
        name: "test_mongo_view",
      },
      "mongo",
    );

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "test_mongo_view",
        context: "hermes",
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
            context: "hermes",
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
            context: "hermes",
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
