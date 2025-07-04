import { LindormError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { MessageKit } from "@lindorm/message";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_SET_STATE,
  TEST_HERMES_EVENT_THROWS,
} from "../__fixtures__/hermes-event";
import { TEST_VIEW_IDENTIFIER } from "../__fixtures__/view";
import {
  TEST_VIEW_EVENT_HANDLER,
  TEST_VIEW_EVENT_HANDLER_CREATE,
  TEST_VIEW_EVENT_HANDLER_DESTROY,
  TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
  TEST_VIEW_EVENT_HANDLER_SET_STATE,
  TEST_VIEW_EVENT_HANDLER_THROWS,
} from "../__fixtures__/view-event-handler";
import {
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../errors";
import { HermesViewEventHandler } from "../handlers";
import { IHermesMessage, IHermesMessageBus, IView, IViewDomain } from "../interfaces";
import { HermesError, HermesEvent } from "../messages";
import { ViewIdentifier } from "../types";
import { ViewDomain } from "./ViewDomain";

describe("ViewDomain", () => {
  const eventKit = new MessageKit({ Message: HermesEvent });

  const logger = createMockLogger();
  const eventHandlers = [
    TEST_VIEW_EVENT_HANDLER,
    TEST_VIEW_EVENT_HANDLER_CREATE,
    TEST_VIEW_EVENT_HANDLER_DESTROY,
    TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
    TEST_VIEW_EVENT_HANDLER_SET_STATE,
    TEST_VIEW_EVENT_HANDLER_THROWS,
  ];

  let domain: IViewDomain;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent>;
  let store: any;

  beforeEach(async () => {
    errorBus = createMockRabbitMessageBus(HermesError);
    eventBus = createMockRabbitMessageBus(HermesEvent);
    store = {
      load: jest.fn().mockImplementation(async (identifier: ViewIdentifier) => ({
        ...identifier,
      })),
      loadCausations: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation(async (view: IView, causation: IHermesMessage) => ({
          ...view.toJSON(),
          revision: view.revision + 1,
          processedCausationIds: [...view.processedCausationIds, causation.id],
        })),
      saveCausations: jest.fn().mockImplementation(async (view: IView) => ({
        ...view.toJSON(),
        revision: view.revision + 1,
        processedCausationIds: [],
      })),
    };

    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  test("should register event handler", async () => {
    eventBus = createMockRabbitMessageBus(HermesEvent);
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    await expect(
      domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER),
    ).resolves.toBeUndefined();

    expect(eventBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.view.default.aggregate_name.hermes_event_default.default.name",
      topic: "default.aggregate_name.hermes_event_default",
    });
  });

  test("should register multiple event handlers", async () => {
    eventBus = createMockRabbitMessageBus(HermesEvent);
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    await expect(
      domain.registerEventHandler(
        new HermesViewEventHandler({
          ...TEST_VIEW_EVENT_HANDLER,
          aggregate: {
            ...TEST_VIEW_EVENT_HANDLER.aggregate,
            context: ["one", "two"],
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(eventBus.subscribe).toHaveBeenCalledTimes(2);

    expect(eventBus.subscribe).toHaveBeenNthCalledWith(1, {
      callback: expect.any(Function),
      queue: "queue.view.one.aggregate_name.hermes_event_default.default.name",
      topic: "one.aggregate_name.hermes_event_default",
    });

    expect(eventBus.subscribe).toHaveBeenNthCalledWith(2, {
      callback: expect.any(Function),
      queue: "queue.view.two.aggregate_name.hermes_event_default.default.name",
      topic: "two.aggregate_name.hermes_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    await domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    await domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER);

    await expect(
      // @ts-expect-error
      domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should handle event", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = eventKit.create({ ...TEST_HERMES_EVENT_CREATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith(
      {
        id: event.aggregate.id,
        context: "default",
        name: "name",
      },
      { type: "custom" },
    );

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "name",
        context: "default",
        processedCausationIds: [],
        destroyed: false,
        revision: 0,
        state: { created: true },
      }),
      event,
      { type: "custom" },
    );
  });

  test("should skip handler when last causation matches event id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = eventKit.create({ ...TEST_HERMES_EVENT_CREATE, aggregate });

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      processedCausationIds: [event.id],
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
  });

  test("should throw on missing handler", async () => {
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    const event = eventKit.create(TEST_HERMES_EVENT);

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).rejects.toThrow(HandlerNotRegisteredError);
  });

  test("should dispatch error on destroyed view", async () => {
    const event = eventKit.create(TEST_HERMES_EVENT);

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      destroyed: true,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "view_destroyed_error",
        data: {
          error: expect.any(ViewDestroyedError),
          message: event,
          view: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    );
  });

  test("should throw on not created view", async () => {
    const event = eventKit.create(TEST_HERMES_EVENT_SET_STATE);

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 0,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).rejects.toThrow(ViewNotCreatedError);

    expect(errorBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on not created view", async () => {
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    await domain.registerEventHandler(
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER_SET_STATE,
        conditions: {
          created: true,
          permanent: true,
        },
      }),
    );

    const event = eventKit.create(TEST_HERMES_EVENT_SET_STATE);

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 0,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "view_not_created_error",
        data: {
          error: expect.any(ViewNotCreatedError),
          message: event,
          view: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    );
  });

  test("should throw on already created view", async () => {
    domain = new ViewDomain({ errorBus, eventBus, store, logger });

    await domain.registerEventHandler(
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER_CREATE,
        conditions: {
          created: false,
          permanent: false,
        },
      }),
    );

    const event = eventKit.create(TEST_HERMES_EVENT_CREATE);

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).rejects.toThrow(ViewAlreadyCreatedError);

    expect(errorBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created view", async () => {
    const event = eventKit.create(TEST_HERMES_EVENT_CREATE);

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "view_already_created_error",
        data: {
          error: expect.any(ViewAlreadyCreatedError),
          message: event,
          view: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    );
  });

  test("should throw from event handler", async () => {
    const event = eventKit.create(TEST_HERMES_EVENT_THROWS);

    store.load.mockImplementation(async (v: ViewIdentifier) => ({
      ...v,
      revision: 1,
      logger,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_VIEW_IDENTIFIER),
    ).rejects.toThrow(new Error("throw"));

    expect(errorBus.publish).not.toHaveBeenCalled();
  });
});
