import { AmqpConnection } from "@lindorm-io/amqp";
import { CacheDomain } from "./CacheDomain";
import { CacheEventHandler } from "../handler";
import { DomainEvent } from "../message";
import { MessageBus, CacheStore } from "../infrastructure";
import { RedisConnection } from "@lindorm-io/redis";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_CACHE_IDENTIFIER } from "../fixtures/cache.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  TEST_CACHE_EVENT_HANDLER,
  TEST_CACHE_EVENT_HANDLER_CREATE,
  TEST_CACHE_EVENT_HANDLER_ADD_FIELD,
  TEST_CACHE_EVENT_HANDLER_DESTROY,
  TEST_CACHE_EVENT_HANDLER_SET_STATE,
} from "../fixtures/cache-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT_ADD_FIELD,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("CacheDomain", () => {
  const logger = createMockLogger();

  let amqp: AmqpConnection;
  let domain: CacheDomain;
  let eventHandlers: Array<CacheEventHandler>;
  let messageBus: MessageBus;
  let redis: RedisConnection;
  let store: CacheStore;

  beforeAll(async () => {
    amqp = new AmqpConnection({
      hostname: "localhost",
      logger,
      port: 5671,
      connectInterval: 500,
      connectTimeout: 30000,
    });

    redis = new RedisConnection({
      host: "localhost",
      port: 6371,
      logger,
    });

    messageBus = new MessageBus({ connection: amqp, logger });
    store = new CacheStore({ connection: redis, logger });
    domain = new CacheDomain({ logger, messageBus, store });

    eventHandlers = [
      TEST_CACHE_EVENT_HANDLER,
      TEST_CACHE_EVENT_HANDLER_CREATE,
      TEST_CACHE_EVENT_HANDLER_ADD_FIELD,
      TEST_CACHE_EVENT_HANDLER_DESTROY,
      TEST_CACHE_EVENT_HANDLER_SET_STATE,
    ];

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    await Promise.all([amqp.connect(), redis.connect()]);
  }, 30000);

  afterAll(async () => {
    await Promise.all([amqp.disconnect(), redis.disconnect()]);
  });

  test("should handle multiple published events", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const cache = { ...TEST_CACHE_IDENTIFIER, id: aggregate.id };

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

    await expect(store.load(cache)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "cache_name",
        context: "default",
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
