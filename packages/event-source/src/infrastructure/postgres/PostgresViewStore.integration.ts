import { DomainEvent } from "../../message";
import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresViewStore } from "./PostgresViewStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { getViewStoreName } from "../../util";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import { stringifyBlob } from "@lindorm-io/string-blob";
import {
  AggregateIdentifier,
  ViewClearProcessedCausationIdsData,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewCausationAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

const insertView = async (
  connection: PostgresConnection,
  attributes: ViewStoreAttributes,
): Promise<void> => {
  const text = `
    INSERT INTO ${getViewStoreName(attributes)} (
      id,
      name,
      context,
      destroyed,
      hash,
      meta,
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
    stringifyBlob(attributes.meta),
    JSON.stringify(attributes.processed_causation_ids),
    attributes.revision,
    stringifyBlob(attributes.state),
  ];
  await connection.query(text, values);
};

const insertCausation = async (
  connection: PostgresConnection,
  attributes: ViewCausationAttributes,
): Promise<void> => {
  const text = `
    INSERT INTO view_causation (
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

const findView = async (
  connection: PostgresConnection,
  identifier: ViewIdentifier,
): Promise<Array<ViewStoreAttributes>> => {
  const text = `
    SELECT *
      FROM ${getViewStoreName(identifier)}
    WHERE 
      id = $1 AND
      name = $2 AND
      context = $3
    LIMIT 1
  `;
  const values = [identifier.id, identifier.name, identifier.context];
  const result = await connection.query<ViewStoreAttributes>(text, values);
  return result.rows.length ? result.rows : [];
};

const findCausations = async (
  connection: PostgresConnection,
  identifier: ViewIdentifier,
): Promise<Array<ViewCausationAttributes>> => {
  const text = `
    SELECT *
    FROM
      view_causation
    WHERE
      id = $1 AND
      name = $2 AND
      context = $3
  `;
  const values = [identifier.id, identifier.name, identifier.context];
  const result = await connection.query<ViewCausationAttributes>(text, values);
  return result.rows.length ? result.rows : [];
};

describe("PostgresViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let connection: PostgresConnection;
  let store: PostgresViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5431,
        user: "root",
        password: "example",
        database: "default_db",
      },
      logger,
    );
    await connection.connect();

    store = new PostgresViewStore(connection, logger);

    // @ts-ignore
    await store.initialise();

    // @ts-ignore
    await store.initialiseView(TEST_VIEW_IDENTIFIER, {});
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
    attributes = {
      ...viewIdentifier,
      destroyed: false,
      hash: randomString(16),
      meta: { data: "state" },
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
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      causation_id: event.id,
      timestamp: event.timestamp,
    });

    await expect(store.causationExists(viewIdentifier, event)).resolves.toBe(true);

    await expect(
      store.causationExists(
        {
          ...viewIdentifier,
          id: randomUUID(),
        },
        event,
      ),
    ).resolves.toBe(false);
  });

  test("should clear processed causation ids", async () => {
    await insertView(connection, attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: ViewClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(store.clearProcessedCausationIds(filter, update, {})).resolves.toBeUndefined();

    await expect(findView(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    ]);
  });

  test("should find view", async () => {
    await insertView(connection, attributes);

    await expect(store.find(viewIdentifier, {})).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    );
  });

  test("should insert view", async () => {
    await expect(store.insert(attributes, {})).resolves.toBeUndefined();

    await expect(findView(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: attributes.hash,
        meta: { json: { data: "state" }, meta: { data: "S" } },
        state: { json: { data: "state" }, meta: { data: "S" } },
      }),
    ]);
  });

  test("should insert processed causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      findCausations(connection, {
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      }),
    ).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should update view", async () => {
    await insertView(connection, attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: ViewUpdateData = {
      destroyed: false,
      hash: randomString(16),
      meta: { meta: true },
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.update(filter, update, {})).resolves.toBeUndefined();

    await expect(findView(connection, attributes)).resolves.toStrictEqual([
      expect.objectContaining({
        hash: update.hash,
        meta: {
          json: { meta: "true" },
          meta: { meta: "B" },
        },
        revision: 2,
        state: {
          json: { updated: "true" },
          meta: { updated: "B" },
        },
      }),
    ]);
  });
});
