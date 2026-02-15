import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { createTestEvent } from "../../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { createTestViewIdentifier } from "../../__fixtures__/create-test-view-identifier";
import { TestEventCreate } from "../../__fixtures__/modules/events/TestEventCreate";
import { VIEW_CAUSATION } from "../../constants/private";
import { IViewStore } from "../../interfaces";
import {
  AggregateIdentifier,
  ViewCausationAttributes,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { PostgresViewStore } from "./PostgresViewStore";

const insertCausation = async (
  source: IPostgresSource,
  attributes: ViewCausationAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<ViewCausationAttributes>(VIEW_CAUSATION);
  await source.query(queryBuilder.insert(attributes));
};

const insertView = async (
  source: IPostgresSource,
  attributes: ViewStoreAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<ViewStoreAttributes>(
    getViewStoreName(attributes),
  );
  await source.query(queryBuilder.insert(attributes));
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
      namespace: filter.namespace,
    }),
  );
  return result.rows;
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
      namespace: filter.namespace,
    }),
  );
  return result.rows;
};

describe("PostgresViewStore", () => {
  const namespace = "pg_vie_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let source: IPostgresSource;
  let store: IViewStore;
  let view: ViewIdentifier;

  beforeAll(async () => {
    source = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    store = new PostgresViewStore(source, logger);

    // @ts-ignore
    await store.initialise();

    // @ts-ignore
    await store.initialiseView(createTestViewIdentifier(namespace), {});
  }, 10000);

  beforeEach(() => {
    aggregate = createTestAggregateIdentifier(namespace);
    view = { ...createTestViewIdentifier(namespace), id: aggregate.id };
    attributes = {
      ...view,
      destroyed: false,
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

  test("should find causation ids", async () => {
    const event = createTestEvent(new TestEventCreate("create"));

    await insertCausation(source, {
      id: view.id,
      name: view.name,
      namespace: view.namespace,
      causation_id: event.causationId,
      created_at: new Date(),
    });

    await expect(store.findCausationIds(view)).resolves.toEqual([event.causationId]);
  });

  test("should find view", async () => {
    await insertView(source, attributes);

    await expect(store.findView(view)).resolves.toEqual(
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
      store.insertCausationIds(view, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      findCausations(source, {
        id: view.id,
        name: view.name,
        namespace: view.namespace,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should insert view", async () => {
    await expect(store.insertView(attributes)).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual([
      expect.objectContaining({
        meta: { data: "state" },
        state: { data: "state" },
      }),
    ]);
  });

  test("should update view", async () => {
    await insertView(source, attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      namespace: attributes.namespace,
      revision: attributes.revision,
    };

    const update: ViewUpdateAttributes = {
      destroyed: false,
      meta: { meta: true },
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.updateView(filter, update)).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual([
      expect.objectContaining({
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
