import { Command, DomainEvent } from "../../message";
import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresSagaStore } from "./PostgresSagaStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_SAGA_IDENTIFIER } from "../../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import { stringifyBlob } from "@lindorm-io/string-blob";
import {
  AggregateIdentifier,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaCausationAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

const insertSaga = async (
  connection: PostgresConnection,
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
    stringifyBlob(attributes.messages_to_dispatch),
    JSON.stringify(attributes.processed_causation_ids),
    attributes.revision,
    stringifyBlob(attributes.state),
  ];
  await connection.query(text, values);
};

const insertCausation = async (
  connection: PostgresConnection,
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
  connection: PostgresConnection,
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
  connection: PostgresConnection,
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
  let connection: PostgresConnection;
  let sagaIdentifier: SagaIdentifier;
  let store: PostgresSagaStore;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5003,
        user: "root",
        password: "example",
        database: "default_db",
      },
      logger,
    );
    await connection.connect();

    store = new PostgresSagaStore(connection, logger);

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
      messages_to_dispatch: [new Command(TEST_COMMAND)],
      processed_causation_ids: [randomUUID()],
      revision: 1,
      state: { data: "state" },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new DomainEvent(TEST_COMMAND);

    await insertCausation(connection, {
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
    await insertSaga(connection, attributes);

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

    await expect(findSaga(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: update.hash,
        messages_to_dispatch: {
          json: [],
          meta: [],
        },
        revision: 2,
      }),
    ]);
  });

  test("should clear processed causation ids", async () => {
    await insertSaga(connection, attributes);

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

    await expect(store.clearProcessedCausationIds(filter, update)).resolves.toBeUndefined();

    await expect(findSaga(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    ]);
  });

  test("should find saga", async () => {
    await insertSaga(connection, attributes);

    await expect(store.find(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    );
  });

  test("should insert saga", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(findSaga(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: attributes.hash,
        state: {
          json: { data: "state" },
          meta: { data: "S" },
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
      findCausations(connection, {
        id: sagaIdentifier.id,
        name: sagaIdentifier.name,
        context: sagaIdentifier.context,
      }),
    ).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should update saga", async () => {
    await insertSaga(connection, attributes);

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

    await expect(findSaga(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: {
          json: { updated: "true" },
          meta: { updated: "B" },
        },
      }),
    ]);
  });
});
