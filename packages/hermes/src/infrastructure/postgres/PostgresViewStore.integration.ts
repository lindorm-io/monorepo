import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_VIEW_IDENTIFIER } from "../../__fixtures__/view";
import { VIEW_CAUSATION } from "../../constants/private";
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
  const queryBuilder = source.queryBuilder<ViewStoreAttributes>(
    getViewStoreName(attributes),
  );
  await source.query(queryBuilder.insert(attributes));
};

const insertCausation = async (
  source: IPostgresSource,
  attributes: ViewCausationAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<ViewCausationAttributes>(VIEW_CAUSATION);
  await source.query(queryBuilder.insert(attributes));
};

const findView = async (
  source: IPostgresSource,
  filter: ViewIdentifier,
): Promise<Array<ViewStoreAttributes>> => {
  const queryBuilder = source.queryBuilder<ViewStoreAttributes>(getViewStoreName(filter));
  const result = await source.query<ViewStoreAttributes>(
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
  filter: ViewIdentifier,
): Promise<Array<ViewCausationAttributes>> => {
  const queryBuilder = source.queryBuilder<ViewCausationAttributes>(VIEW_CAUSATION);
  const result = await source.query<ViewCausationAttributes>(
    queryBuilder.select({
      id: filter.id,
      name: filter.name,
      context: filter.context,
    }),
  );
  return result.rows;
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
      logger,
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

    await expect(store.causationExists(viewIdentifier, event)).resolves.toEqual(true);

    await expect(
      store.causationExists(
        {
          ...viewIdentifier,
          id: randomUUID(),
        },
        event,
      ),
    ).resolves.toEqual(false);
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
        state: { data: "state" },
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
        meta: { data: "state" },
        state: { data: "state" },
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
          meta: true,
        },
        revision: 2,
        state: {
          updated: true,
        },
      }),
    ]);
  });
});
