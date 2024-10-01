import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomString } from "@lindorm/random";
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
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";
import { PostgresSagaStore } from "./PostgresSagaStore";

const insertSaga = async (
  source: IPostgresSource,
  attributes: SagaStoreAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<SagaStoreAttributes>(SAGA_STORE);
  await source.query(queryBuilder.insert(attributes));
};

const insertCausation = async (
  source: IPostgresSource,
  attributes: SagaCausationAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<SagaCausationAttributes>(SAGA_CAUSATION);
  await source.query(queryBuilder.insert(attributes));
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
      hash: randomString(16),
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

  test("should resolve existing causation", async () => {
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    await insertCausation(source, {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      causation_id: event.causationId,
      timestamp: event.timestamp,
    });

    await expect(store.causationExists(sagaIdentifier, event)).resolves.toBe(true);

    await expect(
      store.causationExists(
        {
          ...sagaIdentifier,
          id: randomUUID(),
        },
        event,
      ),
    ).resolves.toBe(false);
  });

  test("should clear messages", async () => {
    await insertSaga(source, attributes);

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaClearMessagesToDispatchData = {
      hash: randomString(16),
      messages_to_dispatch: [],
      revision: 2,
    };

    await expect(store.clearMessagesToDispatch(filter, update)).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: update.hash,
        messages_to_dispatch: [],
        revision: 2,
      }),
    ]);
  });

  test("should clear processed causation ids", async () => {
    await insertSaga(source, attributes);

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(
      store.clearProcessedCausationIds(filter, update),
    ).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    ]);
  });

  test("should find saga", async () => {
    await insertSaga(source, attributes);

    await expect(store.find(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    );
  });

  test("should insert saga", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    ]);
  });

  test("should insert processed causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(sagaIdentifier, [one, two, three]),
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

  test("should update saga", async () => {
    await insertSaga(source, attributes);

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaUpdateData = {
      destroyed: false,
      hash: randomString(16),
      messages_to_dispatch: [],
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.update(filter, update)).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    ]);
  });
});
