import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { createTestCommand, createTestEvent } from "../../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { createTestSagaIdentifier } from "../../__fixtures__/create-test-saga-identifier";
import { TestCommandCreate } from "../../__fixtures__/modules/commands/TestCommandCreate";
import { TestEventCreate } from "../../__fixtures__/modules/events/TestEventCreate";
import { SAGA_CAUSATION } from "../../constants/private";
import { ISagaStore } from "../../interfaces";
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
  const namespace = "mon_sag_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let attributes: SagaStoreAttributes;
  let collection: Collection<SagaStoreAttributes>;
  let saga: SagaIdentifier;
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
    aggregate = createTestAggregateIdentifier(namespace);
    saga = { ...createTestSagaIdentifier(namespace), id: aggregate.id };
    attributes = {
      ...saga,
      destroyed: false,
      messages_to_dispatch: [createTestCommand(new TestCommandCreate("create"))],
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
    const event = createTestEvent(new TestEventCreate("create"));

    const document: SagaCausationAttributes = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      causation_id: event.id,
      created_at: event.timestamp,
    };

    await source.client
      .db("MongoSagaStore")
      .collection(SAGA_CAUSATION)
      .insertOne(document);

    await expect(store.findCausationIds(saga)).resolves.toEqual([event.id]);
  });

  test("should find saga", async () => {
    await collection.insertOne(attributes);

    await expect(store.findSaga(saga)).resolves.toEqual(
      expect.objectContaining({
        state: { state: "state" },
      }),
    );
  });

  test("should insert causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertCausationIds(saga, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      source.client
        .db("MongoSagaStore")
        .collection(SAGA_CAUSATION)
        .find({
          id: saga.id,
          name: saga.name,
          namespace: saga.namespace,
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

    await expect(collection.findOne(saga)).resolves.toEqual(
      expect.objectContaining({
        state: { state: "state" },
      }),
    );
  });

  test("should update saga", async () => {
    await collection.insertOne(attributes);

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      namespace: attributes.namespace,
      revision: attributes.revision,
    };

    const update: SagaUpdateAttributes = {
      destroyed: false,
      messages_to_dispatch: [],
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.updateSaga(filter, update)).resolves.toBeUndefined();

    await expect(collection.findOne(saga)).resolves.toEqual(
      expect.objectContaining({
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
