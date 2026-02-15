import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { createTestCommand, createTestEvent } from "../../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { createTestSagaIdentifier } from "../../__fixtures__/create-test-saga-identifier";
import { TestCommandCreate } from "../../__fixtures__/modules/commands/TestCommandCreate";
import { TestEventCreate } from "../../__fixtures__/modules/events/TestEventCreate";
import { SAGA_CAUSATION, SAGA_STORE } from "../../constants/private";
import { ISagaStore } from "../../interfaces";
import {
  AggregateIdentifier,
  SagaCausationAttributes,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateAttributes,
  SagaUpdateFilter,
} from "../../types";
import { PostgresSagaStore } from "./PostgresSagaStore";

const insertCausation = async (
  source: IPostgresSource,
  attributes: SagaCausationAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<SagaCausationAttributes>(SAGA_CAUSATION);
  await source.query(queryBuilder.insert(attributes));
};

const insertSaga = async (
  source: IPostgresSource,
  attributes: SagaStoreAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<SagaStoreAttributes>(SAGA_STORE);
  await source.query(queryBuilder.insert(attributes));
};

const findCausations = async (
  source: IPostgresSource,
  filter: SagaIdentifier,
): Promise<Array<SagaCausationAttributes>> => {
  const queryBuilder = source.queryBuilder<SagaCausationAttributes>(SAGA_CAUSATION);
  const result = await source.query<SagaCausationAttributes>(
    queryBuilder.select({
      id: filter.id,
      name: filter.name,
      namespace: filter.namespace,
    }),
  );
  return result.rows;
};

const findSaga = async (
  source: IPostgresSource,
  filter: SagaIdentifier,
): Promise<Array<SagaStoreAttributes>> => {
  const queryBuilder = source.queryBuilder<SagaStoreAttributes>(SAGA_STORE);
  const result = await source.query<SagaStoreAttributes>(
    queryBuilder.select({
      id: filter.id,
      name: filter.name,
      namespace: filter.namespace,
    }),
  );
  return result.rows;
};

describe("PostgresSagaStore", () => {
  const namespace = "pg_sag_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let attributes: SagaStoreAttributes;
  let saga: SagaIdentifier;
  let source: IPostgresSource;
  let store: ISagaStore;

  beforeAll(async () => {
    source = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    store = new PostgresSagaStore(source, logger);

    // @ts-ignore
    await store.initialise();
  }, 10000);

  beforeEach(() => {
    aggregate = createTestAggregateIdentifier(namespace);
    saga = { ...createTestSagaIdentifier(namespace), id: aggregate.id };
    attributes = {
      ...saga,
      destroyed: false,
      messages_to_dispatch: [createTestCommand(new TestCommandCreate("create"))],
      processed_causation_ids: [randomUUID()],
      revision: 1,
      state: { data: "state" },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find causation ids", async () => {
    const event = createTestEvent(new TestEventCreate("create"));

    await insertCausation(source, {
      id: attributes.id,
      name: attributes.name,
      namespace: attributes.namespace,
      causation_id: event.causationId,
      created_at: new Date(),
    });

    await expect(store.findCausationIds(saga)).resolves.toEqual([event.causationId]);
  });

  test("should find saga", async () => {
    await insertSaga(source, attributes);

    await expect(store.findSaga(saga)).resolves.toEqual(
      expect.objectContaining({
        state: { data: "state" },
      }),
    );
  });

  test("should insert causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertCausationIds(saga, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      findCausations(source, {
        id: saga.id,
        name: saga.name,
        namespace: saga.namespace,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should insert saga", async () => {
    await expect(store.insertSaga(attributes)).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        state: { data: "state" },
      }),
    ]);
  });

  test("should update saga", async () => {
    await insertSaga(source, attributes);

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      namespace: attributes.namespace,
      revision: attributes.revision,
    };

    const update: SagaUpdateAttributes = {
      destroyed: false,
      messages_to_dispatch: [],
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.updateSaga(filter, update)).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        revision: 2,
        state: { updated: true },
      }),
    ]);
  });
});
