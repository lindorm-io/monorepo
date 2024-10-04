import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import {
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
} from "../__fixtures__/hermes-event";
import { TEST_VIEW_IDENTIFIER } from "../__fixtures__/view";
import {
  TEST_VIEW_EVENT_HANDLER,
  TEST_VIEW_EVENT_HANDLER_CREATE,
  TEST_VIEW_EVENT_HANDLER_DESTROY,
  TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
  TEST_VIEW_EVENT_HANDLER_SET_STATE,
} from "../__fixtures__/view-event-handler";
import { ViewStoreType } from "../enums";
import { HermesViewEventHandler } from "../handlers";
import { MessageBus, ViewStore } from "../infrastructure";
import { IHermesViewEventHandler } from "../interfaces";
import { HermesEvent } from "../messages";
import { ViewDomain } from "./ViewDomain";

describe("ViewDomain", () => {
  const logger = createMockLogger();

  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let domain: ViewDomain;
  let eventHandlers: Array<IHermesViewEventHandler>;
  let messageBus: MessageBus;
  let store: ViewStore;

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

    messageBus = new MessageBus({ rabbit, logger });
    store = new ViewStore({ mongo, logger });
    domain = new ViewDomain({ messageBus, store, logger });

    eventHandlers = [
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER,
        adapter: { type: ViewStoreType.Mongo },
      }),
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER_CREATE,
        adapter: { type: ViewStoreType.Mongo },
      }),
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER_DESTROY,
        adapter: { type: ViewStoreType.Mongo },
      }),
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
        adapter: { type: ViewStoreType.Mongo },
      }),
      new HermesViewEventHandler({
        ...TEST_VIEW_EVENT_HANDLER_SET_STATE,
        adapter: { type: ViewStoreType.Mongo },
      }),
    ];

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published events", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const view = { ...TEST_VIEW_IDENTIFIER, id: aggregate.id };

    const eventCreate = new HermesEvent({
      ...TEST_HERMES_EVENT_CREATE,
      aggregate,
      timestamp: new Date("2022-01-01T08:00:00.000Z"),
    });
    const eventAddField = new HermesEvent({
      ...TEST_HERMES_EVENT_MERGE_STATE,
      aggregate,
      timestamp: new Date("2022-01-02T08:00:00.000Z"),
    });
    const eventSetState = new HermesEvent({
      ...TEST_HERMES_EVENT_SET_STATE,
      aggregate,
      timestamp: new Date("2022-01-03T08:00:00.000Z"),
    });
    const eventDestroy = new HermesEvent({
      ...TEST_HERMES_EVENT_DESTROY,
      aggregate,
      timestamp: new Date("2022-01-04T08:00:00.000Z"),
    });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(250);

    await expect(messageBus.publish(eventAddField)).resolves.toBeUndefined();
    await sleep(250);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(250);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(250);

    await expect(store.load(view, { type: ViewStoreType.Mongo })).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "name",
        context: "default",
        destroyed: true,
        hash: expect.any(String),
        meta: {
          created: {
            destroyed: false,
            timestamp: new Date("2022-01-01T08:00:00.000Z"),
            value: true,
          },
          merge: {
            hermesEventData: {
              destroyed: false,
              timestamp: new Date("2022-01-02T08:00:00.000Z"),
              value: true,
            },
          },
          set: {
            hermesEventData: {
              destroyed: false,
              timestamp: new Date("2022-01-03T08:00:00.000Z"),
              value: true,
            },
          },
        },
        processedCausationIds: [],
        revision: 8,
        state: {
          created: true,
          merge: {
            hermesEventData: true,
          },
          set: {
            hermesEventData: true,
          },
        },
      }),
    );
  }, 30000);
});
