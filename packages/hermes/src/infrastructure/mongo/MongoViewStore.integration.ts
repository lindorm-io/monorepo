import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
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
import { MongoViewStore } from "./MongoViewStore";

describe("MongoViewStore", () => {
  const namespace = "mon_vie_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let collection: Collection<ViewStoreAttributes>;
  let source: IMongoSource;
  let store: IViewStore;
  let view: ViewIdentifier;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoViewStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    collection = source.database.collection(
      getViewStoreName(createTestViewIdentifier(namespace)),
    );

    store = new MongoViewStore(source, logger);
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

    const document: ViewCausationAttributes = {
      id: view.id,
      name: view.name,
      context: view.context,
      causation_id: event.causationId,
      created_at: new Date(),
    };

    await source.client
      .db("MongoViewStore")
      .collection(VIEW_CAUSATION)
      .insertOne(document);

    await expect(store.findCausationIds(view)).resolves.toEqual([event.causationId]);
  });

  test("should find view", async () => {
    await collection.insertOne(attributes);

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
      source.client
        .db("MongoViewStore")
        .collection(VIEW_CAUSATION)
        .find({
          id: view.id,
          name: view.name,
          context: view.context,
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

    await expect(collection.findOne({ id: view.id })).resolves.toEqual(
      expect.objectContaining({
        state: { data: "state" },
      }),
    );
  });

  test("should update view", async () => {
    await collection.insertOne(attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: view.name,
      context: view.context,
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

    await expect(collection.findOne({ id: view.id })).resolves.toEqual(
      expect.objectContaining({
        revision: 2,
        meta: { meta: true },
        state: { updated: true },
      }),
    );
  });
});
