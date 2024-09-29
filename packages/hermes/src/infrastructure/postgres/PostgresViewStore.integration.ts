import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_VIEW_IDENTIFIER } from "../../__fixtures__/view";
import { ViewStoreType } from "../../enums";
import { IViewStore } from "../../interfaces";
import { HermesEvent } from "../../messages";
import {
  AggregateIdentifier,
  ViewCausationAttributes,
  ViewClearProcessedCausationIdsData,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { PostgresViewStore } from "./PostgresViewStore";

const insertView = async (
  source: IPostgresSource,
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
    JsonKit.stringify(attributes.meta),
    JSON.stringify(attributes.processed_causation_ids),
    attributes.revision,
    JsonKit.stringify(attributes.state),
  ];
  await source.query(text, values);
};

const insertCausation = async (
  source: IPostgresSource,
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
  await source.query(text, values);
};

const findView = async (
  source: IPostgresSource,
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
  const result = await source.query<ViewStoreAttributes>(text, values);
  return result.rows.length ? result.rows : [];
};

const findCausations = async (
  source: IPostgresSource,
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
  const result = await source.query<ViewCausationAttributes>(text, values);
  return result.rows.length ? result.rows : [];
};

describe("PostgresViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let source: IPostgresSource;
  let store: IViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    source = new PostgresSource({
      logger: createMockLogger(),
      url: "postgres://root:example@localhost:5432/default",
    });

    store = new PostgresViewStore(source, logger);

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
    await source.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    await insertCausation(source, {
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
    await insertView(source, attributes);

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

    await expect(
      store.clearProcessedCausationIds(filter, update, { type: ViewStoreType.Postgres }),
    ).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    ]);
  });

  test("should find view", async () => {
    await insertView(source, attributes);

    await expect(
      store.find(viewIdentifier, { type: ViewStoreType.Postgres }),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { __meta__: { data: "S" }, __record__: { data: "state" } },
      }),
    );
  });

  test("should insert view", async () => {
    await expect(
      store.insert(attributes, { type: ViewStoreType.Postgres }),
    ).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: attributes.hash,
        meta: { __record__: { data: "state" }, __meta__: { data: "S" } },
        state: { __record__: { data: "state" }, __meta__: { data: "S" } },
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
      findCausations(source, {
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should update view", async () => {
    await insertView(source, attributes);

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

    await expect(
      store.update(filter, update, { type: ViewStoreType.Postgres }),
    ).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        hash: update.hash,
        meta: {
          __record__: { meta: "true" },
          __meta__: { meta: "B" },
        },
        revision: 2,
        state: {
          __record__: { updated: "true" },
          __meta__: { updated: "B" },
        },
      }),
    ]);
  });
});
