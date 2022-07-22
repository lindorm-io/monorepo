import { AmqpConnection } from "@lindorm-io/amqp";
import { DomainEvent } from "../message";
import { MessageBus, SagaStore } from "../infrastructure";
import { MongoConnection } from "@lindorm-io/mongo";
import { SagaDomain } from "./SagaDomain";
import { SagaEventHandler } from "../handler";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_SAGA_IDENTIFIER } from "../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  TEST_SAGA_EVENT_HANDLER,
  TEST_SAGA_EVENT_HANDLER_CREATE,
  TEST_SAGA_EVENT_HANDLER_DESTROY,
  TEST_SAGA_EVENT_HANDLER_DISPATCH,
  TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
  TEST_SAGA_EVENT_HANDLER_SET_STATE,
  TEST_SAGA_EVENT_HANDLER_TIMEOUT,
} from "../fixtures/saga-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("SagaDomain", () => {
  const logger = createMockLogger();

  let amqp: AmqpConnection;
  let domain: SagaDomain;
  let eventHandlers: Array<SagaEventHandler>;
  let messageBus: MessageBus;
  let mongo: MongoConnection;
  let store: SagaStore;

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
    store = new SagaStore({ connection: mongo, logger });
    domain = new SagaDomain({ logger, messageBus, store });

    eventHandlers = [
      TEST_SAGA_EVENT_HANDLER,
      TEST_SAGA_EVENT_HANDLER_CREATE,
      TEST_SAGA_EVENT_HANDLER_DESTROY,
      TEST_SAGA_EVENT_HANDLER_DISPATCH,
      TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
      TEST_SAGA_EVENT_HANDLER_SET_STATE,
      TEST_SAGA_EVENT_HANDLER_TIMEOUT,
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
    const saga = { ...TEST_SAGA_IDENTIFIER, id: aggregate.id };

    const eventCreate = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const eventMergeState = new DomainEvent({ ...TEST_DOMAIN_EVENT_MERGE_STATE, aggregate });
    const eventSetState = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const eventDestroy = new DomainEvent({ ...TEST_DOMAIN_EVENT_DESTROY, aggregate });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(2000);

    await expect(store.load(saga)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "sagaName",
        context: "sagaContext",
        causationList: [eventCreate.id, eventMergeState.id, eventSetState.id, eventDestroy.id],
        destroyed: true,
        messagesToDispatch: [],
        revision: 4,
        state: {
          created: true,
          merge: { domainEventData: true },
          path: { value: { domainEventData: true } },
        },
      }),
    );
  }, 30000);
});
