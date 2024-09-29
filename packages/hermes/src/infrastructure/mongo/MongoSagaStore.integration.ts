import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_SAGA_IDENTIFIER } from "../../__fixtures__/saga";
import { SAGA_CAUSATION, SAGA_STORE } from "../../constants/private";
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
import { MongoSagaStore } from "./MongoSagaStore";

describe("MongoSagaStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: SagaStoreAttributes;
  let collection: Collection<SagaStoreAttributes>;
  let sagaIdentifier: SagaIdentifier;
  let source: IMongoSource;
  let store: ISagaStore;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoSagaStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    collection = source.database.collection("saga_store");

    store = new MongoSagaStore(source, logger);
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    sagaIdentifier = { ...TEST_SAGA_IDENTIFIER, id: aggregateIdentifier.id };
    attributes = {
      id: sagaIdentifier.id,
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      messages_to_dispatch: [new HermesCommand(TEST_HERMES_COMMAND)],
      processed_causation_ids: [randomUUID()],
      revision: 1,
      state: { state: "state" },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    const document: SagaCausationAttributes = {
      id: sagaIdentifier.id,
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
      causation_id: event.id,
      timestamp: new Date(),
    };

    await source.client
      .db("MongoSagaStore")
      .collection(SAGA_CAUSATION)
      .insertOne(document);

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
    await collection.insertOne({ ...attributes });

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

    await expect(collection.findOne(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        messages_to_dispatch: [],
        revision: update.revision,
      }),
    );
  });

  test("should clear processed causation ids", async () => {
    await collection.insertOne({ ...attributes });

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

    await expect(
      source.client.db("MongoSagaStore").collection(SAGA_STORE).findOne(sagaIdentifier),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: update.revision,
      }),
    );
  });

  test("should find saga", async () => {
    await collection.insertOne({ ...attributes });

    await expect(store.find(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert saga", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(collection.findOne(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert processed causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(sagaIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    const cursor = source.client.db("MongoSagaStore").collection(SAGA_CAUSATION).find({
      id: sagaIdentifier.id,
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
    });

    await expect(cursor.toArray()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ causation_id: one }),
        expect.objectContaining({ causation_id: two }),
        expect.objectContaining({ causation_id: three }),
      ]),
    );
  });

  test("should update saga", async () => {
    await collection.insertOne({ ...attributes });

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

    await expect(
      source.client.db("MongoSagaStore").collection(SAGA_STORE).findOne(sagaIdentifier),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
