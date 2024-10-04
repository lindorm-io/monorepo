import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_SAGA_IDENTIFIER } from "../../__fixtures__/saga";
import { SAGA_CAUSATION } from "../../constants/private";
import { ISagaStore } from "../../interfaces";
import { HermesCommand, HermesEvent } from "../../messages";
import {
  AggregateIdentifier,
  SagaCausationAttributes,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateAttributes,
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
      ...sagaIdentifier,
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

  test("should find causation ids", async () => {
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

    await expect(store.findCausationIds(sagaIdentifier)).resolves.toEqual([
      event.causationId,
    ]);
  });

  test("should find saga", async () => {
    await collection.insertOne(attributes);

    await expect(store.findSaga(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertCausationIds(sagaIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      source.client
        .db("MongoSagaStore")
        .collection(SAGA_CAUSATION)
        .find({
          id: sagaIdentifier.id,
          name: sagaIdentifier.name,
          context: sagaIdentifier.context,
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

  test("should insert saga", async () => {
    await expect(store.insertSaga(attributes)).resolves.toBeUndefined();

    await expect(collection.findOne(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should update saga", async () => {
    await collection.insertOne(attributes);

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaUpdateAttributes = {
      destroyed: false,
      hash: randomString(16),
      messages_to_dispatch: [],
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.updateSaga(filter, update)).resolves.toBeUndefined();

    await expect(collection.findOne(sagaIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
