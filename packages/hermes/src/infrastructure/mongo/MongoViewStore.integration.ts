import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
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
import { MongoViewStore } from "./MongoViewStore";

describe("MongoViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
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

    store = new MongoViewStore(source, logger);
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    const document: ViewCausationAttributes = {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      causation_id: event.id,
      timestamp: new Date(),
    };

    await source.client
      .db("MongoViewStore")
      .collection(VIEW_CAUSATION)
      .insertOne(document);

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
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: ["processed"],
      revision: 1,
      state: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    await source.client
      .db("MongoViewStore")
      .collection(getViewStoreName(viewIdentifier))
      .insertOne(attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: ViewClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(
      store.clearProcessedCausationIds(filter, update, { type: ViewStoreType.Mongo }),
    ).resolves.toBeUndefined();

    await expect(
      source.client
        .db("MongoViewStore")
        .collection(getViewStoreName(viewIdentifier))
        .findOne({ id: viewIdentifier.id }),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    );
  });

  test("should find view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { found: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await source.client
      .db("MongoViewStore")
      .collection(getViewStoreName(viewIdentifier))
      .insertOne(attributes);

    await expect(
      store.find(viewIdentifier, { type: ViewStoreType.Mongo }),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { found: true },
      }),
    );
  });

  test("should insert view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: { meta: true },
      processed_causation_ids: [],
      revision: 1,
      state: { inserted: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await expect(
      store.insert(attributes, { type: ViewStoreType.Mongo }),
    ).resolves.toBeUndefined();

    await expect(
      source.client
        .db("MongoViewStore")
        .collection(getViewStoreName(viewIdentifier))
        .findOne({ id: viewIdentifier.id }),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { inserted: true },
      }),
    );
  });

  test("should insert processed causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    const cursor = source.client.db("MongoViewStore").collection(VIEW_CAUSATION).find({
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
    });

    await expect(cursor.toArray()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should update view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    await source.client
      .db("MongoViewStore")
      .collection(getViewStoreName(viewIdentifier))
      .insertOne(attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
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
      store.update(filter, update, { type: ViewStoreType.Mongo }),
    ).resolves.toBeUndefined();

    await expect(
      source.client
        .db("MongoViewStore")
        .collection(getViewStoreName(viewIdentifier))
        .findOne({ id: viewIdentifier.id }),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        meta: { meta: true },
        state: { updated: true },
      }),
    );
  });
});
