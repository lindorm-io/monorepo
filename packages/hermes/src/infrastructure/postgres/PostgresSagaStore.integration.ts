import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_SAGA_IDENTIFIER } from "../../__fixtures__/saga";
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
  const text = `
    INSERT INTO saga_store (
      id,
      name,
      context,
      destroyed,
      hash,
      messages_to_dispatch,
      processed_causation_ids,
      revision,
      state
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `;
  const values = [
    attributes.id,
    attributes.name,
    attributes.context,
    attributes.destroyed,
    attributes.hash,
    JsonKit.stringify(attributes.messages_to_dispatch),
    JSON.stringify(attributes.processed_causation_ids),
    attributes.revision,
    JsonKit.stringify(attributes.state),
  ];
  await source.query(text, values);
};

const insertCausation = async (
  connection: IPostgresSource,
  attributes: SagaCausationAttributes,
): Promise<void> => {
  const text = `
    INSERT INTO saga_causation (
      id,
      name,
      context,
      causation_id,
      timestamp
    ) 
    VALUES ($1,$2,$3,$4,$5)
  `;
  const values = [
    attributes.id,
    attributes.name,
    attributes.context,
    attributes.causation_id,
    attributes.timestamp,
  ];
  await connection.query(text, values);
};

const findSaga = async (
  connection: IPostgresSource,
  identifier: SagaIdentifier,
): Promise<Array<SagaStoreAttributes>> => {
  const text = `
    SELECT *
      FROM saga_store
    WHERE 
      id = $1 AND
      name = $2 AND
      context = $3
    LIMIT 1
  `;
  const values = [identifier.id, identifier.name, identifier.context];
  const result = await connection.query<SagaStoreAttributes>(text, values);
  return result.rows.length ? result.rows : [];
};

const findCausations = async (
  connection: IPostgresSource,
  identifier: SagaIdentifier,
): Promise<Array<SagaCausationAttributes>> => {
  const text = `
    SELECT *
    FROM
      saga_causation
    WHERE
      id = $1 AND
      name = $2 AND
      context = $3
  `;
  const values = [identifier.id, identifier.name, identifier.context];
  const result = await connection.query<SagaCausationAttributes>(text, values);
  return result.rows.length ? result.rows : [];
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
      logger: createMockLogger(),
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
        messages_to_dispatch: {
          __meta__: [],
          __array__: [],
        },
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
        state: {
          __meta__: { data: "S" },
          __record__: { data: "state" },
        },
      }),
    );
  });

  test("should insert saga", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(findSaga(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: attributes.hash,
        state: {
          __meta__: { data: "S" },
          __record__: { data: "state" },
        },
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
        state: {
          __record__: { updated: "true" },
          __meta__: { updated: "B" },
        },
      }),
    ]);
  });
});
