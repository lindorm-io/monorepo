import { DomainEvent } from "../message";
import { MessageBus, ViewStore } from "../infrastructure";
import { MessageBusType } from "../enum";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { ViewDomain } from "./ViewDomain";
import { ViewEventHandlerImplementation } from "../handler";
import { createMockLogger } from "@lindorm-io/core-logger";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  TEST_VIEW_EVENT_HANDLER,
  TEST_VIEW_EVENT_HANDLER_CREATE,
  TEST_VIEW_EVENT_HANDLER_DESTROY,
  TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
  TEST_VIEW_EVENT_HANDLER_SET_STATE,
} from "../fixtures/view-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("ViewDomain", () => {
  const logger = createMockLogger();

  let domain: ViewDomain;
  let eventHandlers: Array<ViewEventHandlerImplementation>;
  let messageBus: MessageBus;
  let store: ViewStore;

  beforeAll(async () => {
    messageBus = new MessageBus({ type: MessageBusType.MEMORY }, logger);
    store = new ViewStore({}, logger);
    domain = new ViewDomain({ messageBus, store }, logger);

    eventHandlers = [
      TEST_VIEW_EVENT_HANDLER,
      TEST_VIEW_EVENT_HANDLER_CREATE,
      TEST_VIEW_EVENT_HANDLER_DESTROY,
      TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
      TEST_VIEW_EVENT_HANDLER_SET_STATE,
    ];

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  test("should handle multiple published events", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const view = { ...TEST_VIEW_IDENTIFIER, id: aggregate.id };

    const eventCreate = new DomainEvent({
      ...TEST_DOMAIN_EVENT_CREATE,
      aggregate,
      timestamp: new Date("2022-01-01T08:00:00.000Z"),
    });
    const eventAddField = new DomainEvent({
      ...TEST_DOMAIN_EVENT_MERGE_STATE,
      aggregate,
      timestamp: new Date("2022-01-02T08:00:00.000Z"),
    });
    const eventSetState = new DomainEvent({
      ...TEST_DOMAIN_EVENT_SET_STATE,
      aggregate,
      timestamp: new Date("2022-01-03T08:00:00.000Z"),
    });
    const eventDestroy = new DomainEvent({
      ...TEST_DOMAIN_EVENT_DESTROY,
      aggregate,
      timestamp: new Date("2022-01-04T08:00:00.000Z"),
    });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventAddField)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(50);

    await expect(store.load(view, { type: "memory" })).resolves.toStrictEqual(
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
            domainEventData: {
              destroyed: false,
              timestamp: new Date("2022-01-02T08:00:00.000Z"),
              value: true,
            },
          },
          set: {
            domainEventData: {
              destroyed: false,
              timestamp: new Date("2022-01-03T08:00:00.000Z"),
              value: true,
            },
          },
        },
        processedCausationIds: [
          eventCreate.id,
          eventAddField.id,
          eventSetState.id,
          eventDestroy.id,
        ],
        revision: 4,
        state: {
          created: true,
          merge: {
            domainEventData: true,
          },
          set: {
            domainEventData: true,
          },
        },
      }),
    );
  }, 30000);
});
