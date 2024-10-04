import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_SAGA_IDENTIFIER } from "../../__fixtures__/saga";
import { SAGA_CAUSATION, SAGA_STORE } from "../../constants/private";
import { ISagaStore } from "../../interfaces";
import { HermesCommand, HermesEvent } from "../../messages";
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
      context: filter.context,
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
      context: filter.context,
    }),
  );
  return result.rows;
};

describe("PostgresSagaStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: SagaStoreAttributes;
  let source: IPostgresSource;
  let sagaIdentifier: SagaIdentifier;
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
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    sagaIdentifier = { ...TEST_SAGA_IDENTIFIER, id: aggregateIdentifier.id };
    attributes = {
      ...sagaIdentifier,
      destroyed: false,
      messages_to_dispatch: [new HermesCommand(TEST_HERMES_COMMAND)],
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
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    await insertCausation(source, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      causation_id: event.causationId,
      timestamp: event.timestamp,
    });

    await expect(store.findCausationIds(sagaIdentifier)).resolves.toEqual([
      event.causationId,
    ]);
  });

  test("should find saga", async () => {
    await insertSaga(source, attributes);

    await expect(store.findSaga(sagaIdentifier)).resolves.toEqual(
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
      store.insertCausationIds(sagaIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      findCausations(source, {
        id: sagaIdentifier.id,
        name: sagaIdentifier.name,
        context: sagaIdentifier.context,
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
      context: attributes.context,
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
