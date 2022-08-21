import { DomainEvent } from "../../message";
import { MongoConnection } from "@lindorm-io/mongo";
import { MongoViewStore } from "./MongoViewStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { VIEW_CAUSATION_COLLECTION } from "../../constant";
import { createMockLogger } from "@lindorm-io/winston";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  AggregateIdentifier,
  ViewStoreAttributes,
  ViewStoreCausationAttributes,
  ViewClearProcessedCausationIdsData,
  ViewIdentifier,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

describe("MongoViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let connection: MongoConnection;
  let store: MongoViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 27011,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "MongoViewStore",
      },
      logger,
    );

    store = new MongoViewStore(connection, logger);

    await connection.connect();
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new DomainEvent(TEST_COMMAND);

    const document: ViewStoreCausationAttributes = {
      view_id: viewIdentifier.id,
      view_name: viewIdentifier.name,
      view_context: viewIdentifier.context,
      causation_id: event.id,
      timestamp: new Date(),
    };

    await connection.client
      .db("MongoViewStore")
      .collection(VIEW_CAUSATION_COLLECTION)
      .insertOne(document);

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
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "view_name",
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

    await connection.client
      .db("MongoViewStore")
      .collection(MongoViewStore.getCollectionName(viewIdentifier))
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

    await expect(store.clearProcessedCausationIds(filter, update, {})).resolves.toBeUndefined();

    await expect(
      connection.client
        .db("MongoViewStore")
        .collection(MongoViewStore.getCollectionName(viewIdentifier))
        .findOne({ id: viewIdentifier.id }),
    ).resolves.toStrictEqual(
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
      name: "view_name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 1,
      meta: {},
      state: { found: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await connection.client
      .db("MongoViewStore")
      .collection(MongoViewStore.getCollectionName(viewIdentifier))
      .insertOne(attributes);

    await expect(store.find(viewIdentifier, {})).resolves.toStrictEqual(
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
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { inserted: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await expect(store.insert(attributes, {})).resolves.toBeUndefined();

    await expect(
      connection.client
        .db("MongoViewStore")
        .collection(MongoViewStore.getCollectionName(viewIdentifier))
        .findOne({ id: viewIdentifier.id }),
    ).resolves.toStrictEqual(
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

    const cursor = connection.client
      .db("MongoViewStore")
      .collection(VIEW_CAUSATION_COLLECTION)
      .find({
        view_id: viewIdentifier.id,
        view_name: viewIdentifier.name,
        view_context: viewIdentifier.context,
      });

    await expect(cursor.toArray()).resolves.toStrictEqual([
      expect.objectContaining({ causation_id: one }),
      expect.objectContaining({ causation_id: two }),
      expect.objectContaining({ causation_id: three }),
    ]);
  });

  test("should update view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "view_name",
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

    await connection.client
      .db("MongoViewStore")
      .collection(MongoViewStore.getCollectionName(viewIdentifier))
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
      meta: {},
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.update(filter, update, {})).resolves.toBeUndefined();

    await expect(
      connection.client
        .db("MongoViewStore")
        .collection(MongoViewStore.getCollectionName(viewIdentifier))
        .findOne({ id: viewIdentifier.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
