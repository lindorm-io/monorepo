import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_VIEW_IDENTIFIER } from "../../__fixtures__/view";
import { VIEW_CAUSATION } from "../../constants/private";
import { IViewStore } from "../../interfaces";
import { HermesEvent } from "../../messages";
import {
  AggregateIdentifier,
  ViewCausationAttributes,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { MongoViewStore } from "./MongoViewStore";

describe("MongoViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let collection: Collection<ViewStoreAttributes>;
  let source: IMongoSource;
  let store: IViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoViewStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    collection = source.database.collection(getViewStoreName(TEST_VIEW_IDENTIFIER));

    store = new MongoViewStore(source, logger);
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
    attributes = {
      ...viewIdentifier,
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
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    const document: ViewCausationAttributes = {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      causation_id: event.causationId,
      timestamp: new Date(),
    };

    await source.client
      .db("MongoViewStore")
      .collection(VIEW_CAUSATION)
      .insertOne(document);

    await expect(store.findCausationIds(viewIdentifier)).resolves.toEqual([
      event.causationId,
    ]);
  });

  test("should find view", async () => {
    await collection.insertOne(attributes);

    await expect(store.findView(viewIdentifier)).resolves.toEqual(
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
      store.insertCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      source.client
        .db("MongoViewStore")
        .collection(VIEW_CAUSATION)
        .find({
          id: viewIdentifier.id,
          name: viewIdentifier.name,
          context: viewIdentifier.context,
        })
        .toArray(),
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

    await expect(collection.findOne({ id: viewIdentifier.id })).resolves.toEqual(
      expect.objectContaining({
        state: { data: "state" },
      }),
    );
  });

  test("should update view", async () => {
    await collection.insertOne(attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
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

    await expect(collection.findOne({ id: viewIdentifier.id })).resolves.toEqual(
      expect.objectContaining({
        revision: 2,
        meta: { meta: true },
        state: { updated: true },
      }),
    );
  });
});
