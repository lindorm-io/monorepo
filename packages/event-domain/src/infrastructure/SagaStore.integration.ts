import { AggregateIdentifier, SagaIdentifier } from "../types";
import { DomainEvent } from "../message";
import { MongoConnection } from "@lindorm-io/mongo";
import { Saga } from "../entity";
import { SagaStore } from "./SagaStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_SAGA_IDENTIFIER } from "../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DISPATCH,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("SagaStore", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let connection: MongoConnection;
  let saga: SagaIdentifier;
  let store: SagaStore;

  beforeAll(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      logger,
      database: "db",
    });

    store = new SagaStore({ connection, logger });

    await connection.connect();
  }, 30000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    saga = { ...TEST_SAGA_IDENTIFIER, id: aggregate.id };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save new saga", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Saga(saga, logger);

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [event.id],
        destroyed: false,
        messagesToDispatch: [],
        revision: 1,
        state: {},
      }),
    );
  }, 10000);

  test("should save existing saga", async () => {
    const event1 = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Saga(
      {
        ...saga,
        state: {
          created: true,
        },
      },
      logger,
    );

    const saved = await store.save(entity, event1);
    const event2 = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const changed = new Saga(
      {
        ...saved.toJSON(),
        state: {
          ...saved.toJSON().state,
          changed: true,
        },
      },
      logger,
    );

    await expect(store.save(changed, event2)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [event1.id, event2.id],
        destroyed: false,
        messagesToDispatch: [],
        revision: 2,
        state: {
          created: true,
          changed: true,
        },
      }),
    );
  }, 10000);

  test("should load new saga", async () => {
    await expect(store.load(saga)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 0,
        state: {},
      }),
    );
  });

  test("should load existing saga", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Saga({ ...saga, state: { created: true } }, logger);

    await store.save(entity, event);

    await expect(store.load(saga)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [event.id],
        destroyed: false,
        messagesToDispatch: [],
        revision: 1,
        state: { created: true },
      }),
    );
  });

  test("should clear messages to dispatch", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Saga(
      {
        ...saga,
        messagesToDispatch: [new DomainEvent({ ...TEST_DOMAIN_EVENT_DISPATCH, aggregate })],
        state: { created: true },
      },
      logger,
    );

    const saved = await store.save(entity, event);

    await expect(store.clearMessagesToDispatch(saved)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [event.id],
        destroyed: false,
        messagesToDispatch: [],
        revision: 2,
        state: { created: true },
      }),
    );
  });
});
