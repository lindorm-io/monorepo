import { AggregateIdentifier, ViewIdentifier, ViewStoreDocumentOptions } from "../types";
import { DomainEvent } from "../message";
import { MongoConnection } from "@lindorm-io/mongo";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { View } from "../entity";
import { ViewStore } from "./ViewStore";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("ViewStore", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let connection: MongoConnection;
  let documentOptions: ViewStoreDocumentOptions;
  let store: ViewStore;
  let view: ViewIdentifier;

  beforeAll(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      logger,
      database: "db",
    });

    store = new ViewStore({ connection, logger });

    await connection.connect();
  }, 30000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    documentOptions = {};
    view = { ...TEST_VIEW_IDENTIFIER, id: aggregate.id };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save new view", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new View(view, logger);

    await expect(store.save(entity, event, documentOptions)).resolves.toStrictEqual(
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
  }, 10000);

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

    const saved = await store.save(entity, event1, documentOptions);
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

    await expect(store.save(changed, event2, documentOptions)).resolves.toStrictEqual(
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
  }, 10000);

  test("should load new view", async () => {
    await expect(store.load(view, documentOptions)).resolves.toStrictEqual(
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

    await store.save(entity, event, documentOptions);

    await expect(store.load(view, documentOptions)).resolves.toStrictEqual(
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
