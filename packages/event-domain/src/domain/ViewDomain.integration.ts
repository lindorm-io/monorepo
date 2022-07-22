import { AmqpConnection } from "@lindorm-io/amqp";
import { DomainEvent } from "../message";
import { MessageBus, ViewStore } from "../infrastructure";
import { MongoConnection } from "@lindorm-io/mongo";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { ViewDomain } from "./ViewDomain";
import { ViewEventHandler } from "../handler";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  TEST_VIEW_EVENT_HANDLER,
  TEST_VIEW_EVENT_HANDLER_CREATE,
  TEST_VIEW_EVENT_HANDLER_ADD_FIELD,
  TEST_VIEW_EVENT_HANDLER_DESTROY,
  TEST_VIEW_EVENT_HANDLER_SET_STATE,
} from "../fixtures/view-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT_ADD_FIELD,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("ViewDomain", () => {
  const logger = createMockLogger();
  const documentOptions = TEST_VIEW_EVENT_HANDLER.documentOptions;

  let amqp: AmqpConnection;
  let domain: ViewDomain;
  let eventHandlers: Array<ViewEventHandler>;
  let messageBus: MessageBus;
  let mongo: MongoConnection;
  let store: ViewStore;

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
    store = new ViewStore({ connection: mongo, logger });
    domain = new ViewDomain({ logger, messageBus, store });

    domain.on("error", () => {});
    domain.on("event", () => {});

    eventHandlers = [
      TEST_VIEW_EVENT_HANDLER,
      TEST_VIEW_EVENT_HANDLER_CREATE,
      TEST_VIEW_EVENT_HANDLER_ADD_FIELD,
      TEST_VIEW_EVENT_HANDLER_DESTROY,
      TEST_VIEW_EVENT_HANDLER_SET_STATE,
    ];

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    await Promise.all([amqp.connect(), mongo.connect()]);
  }, 30000);

  afterAll(async () => {
    await Promise.all([amqp.disconnect(), mongo.disconnect()]);
  });

  test("should handle multiple published events", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const view = { ...TEST_VIEW_IDENTIFIER, id: aggregate.id };

    const eventCreate = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const eventAddField = new DomainEvent({ ...TEST_DOMAIN_EVENT_ADD_FIELD, aggregate });
    const eventSetState = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const eventDestroy = new DomainEvent({ ...TEST_DOMAIN_EVENT_DESTROY, aggregate });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(eventAddField)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(store.load(view, documentOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "viewName",
        context: "viewContext",
        causationList: [eventCreate.id, eventAddField.id, eventSetState.id, eventDestroy.id],
        destroyed: true,
        meta: {
          created: {
            removed: false,
            timestamp: expect.any(Date),
            value: true,
          },
          field: {
            record: [
              {
                removed: false,
                timestamp: expect.any(Date),
                value: { record: true },
              },
            ],
            string: [
              {
                removed: false,
                timestamp: expect.any(Date),
                value: "value",
              },
            ],
          },
          path: {
            removed: false,
            timestamp: expect.any(Date),
            value: { value: { domainEventData: true } },
          },
        },
        revision: 4,
        state: {
          created: true,
          field: {
            record: [{ record: true }],
            string: ["value"],
          },
          path: {
            value: { domainEventData: true },
          },
        },
      }),
    );
  }, 30000);
});
