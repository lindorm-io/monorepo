import { AggregateIdentifier, ViewIdentifier, ViewStoreHandlerOptions } from "../../types";
import { DomainEvent } from "../../message";
import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresViewStore } from "./PostgresViewStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { View } from "../../model";
import { createMockLogger } from "@lindorm-io/winston";
import { createViewEntities } from "../../util";
import { randomUUID } from "crypto";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../../fixtures/domain-event.fixture";
import { ViewStoreType } from "../../enum";

describe("PostgresViewStore", () => {
  const logger = createMockLogger();
  const { ViewEntity, ViewCausationEntity } = createViewEntities("ViewCausationEntity");

  const handlerOptions: ViewStoreHandlerOptions = {
    type: ViewStoreType.POSTGRES,
    postgres: {
      viewEntity: ViewEntity,
      causationEntity: ViewCausationEntity,
    },
  };

  let aggregate: AggregateIdentifier;
  let connection: PostgresConnection;
  let store: PostgresViewStore;
  let view: ViewIdentifier;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [ViewEntity, ViewCausationEntity],
        synchronize: true,
      },
      logger,
    );

    store = new PostgresViewStore(connection, logger);

    await connection.connect();
  }, 30000);

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
        processedCausationIds: [event.id],
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

    const saved = await store.save(entity, event1, handlerOptions);
    const event2 = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const json = saved.toJSON();
    const changed = new View(
      {
        ...json,
        state: {
          ...json.state,
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
        processedCausationIds: [event1.id, event2.id],
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
    await expect(store.load(view, handlerOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "view_name",
        context: "default",
        processedCausationIds: [],
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
        processedCausationIds: [event.id],
        destroyed: false,
        meta: {},
        revision: 1,
        state: { created: true },
      }),
    );
  });
});
