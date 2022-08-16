import { AggregateIdentifier, ViewIdentifier, ViewStoreHandlerOptions } from "../../types";
import { DomainEvent } from "../../message";
import { RedisConnection } from "@lindorm-io/redis";
import { RedisViewStore } from "./RedisViewStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { View } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../../fixtures/domain-event.fixture";
import { ViewStoreType } from "../../enum";

describe("RedisViewStore", () => {
  const logger = createMockLogger();
  const handlerOptions: ViewStoreHandlerOptions = { type: ViewStoreType.REDIS };

  let aggregate: AggregateIdentifier;
  let connection: RedisConnection;
  let store: RedisViewStore;
  let view: ViewIdentifier;

  beforeAll(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 6371,
      },
      logger,
    );

    store = new RedisViewStore(connection, logger);

    await connection.connect();
  }, 10000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    view = { ...TEST_VIEW_IDENTIFIER, id: aggregate.id };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save new view", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new View(view, logger);

    await expect(store.save(entity, event, handlerOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "view_name",
        context: "default",
        causationList: [event.id],
        destroyed: false,
        meta: {},
        revision: 1,
        state: {},
      }),
    );
  });

  test("should save existing view", async () => {
    const event1 = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new View(
      {
        ...view,
        state: {
          created: true,
        },
      },
      logger,
    );

    const saved = await store.save(entity, event1, handlerOptions);
    const event2 = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const changed = new View(
      {
        ...saved.toJSON(),
        state: {
          ...saved.toJSON().state,
          changed: true,
        },
      },
      logger,
    );

    await expect(store.save(changed, event2, handlerOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "view_name",
        context: "default",
        causationList: [event1.id, event2.id],
        destroyed: false,
        meta: {},
        revision: 2,
        state: {
          created: true,
          changed: true,
        },
      }),
    );
  });

  test("should load new view", async () => {
    await expect(store.load(view, handlerOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "view_name",
        context: "default",
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 0,
        state: {},
      }),
    );
  });

  test("should load existing view", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new View({ ...view, state: { created: true } }, logger);

    await store.save(entity, event, handlerOptions);

    await expect(store.load(view, handlerOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "view_name",
        context: "default",
        causationList: [event.id],
        destroyed: false,
        meta: {},
        revision: 1,
        state: { created: true },
      }),
    );
  });
});
