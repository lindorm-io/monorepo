import { Command, DomainEvent } from "../../message";
import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresSagaStore } from "./PostgresSagaStore";
import { SagaCausationEntity, SagaEntity } from "./entity";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_SAGA_IDENTIFIER } from "../../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  AggregateIdentifier,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

describe("PostgresSagaStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: SagaStoreAttributes;
  let connection: PostgresConnection;
  let sagaIdentifier: SagaIdentifier;
  let store: PostgresSagaStore;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [SagaEntity, SagaCausationEntity],
        synchronize: true,
      },
      logger,
    );

    store = new PostgresSagaStore(connection, logger);

    await connection.connect();
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
      messages_to_dispatch: [new Command(TEST_COMMAND)],
      processed_causation_ids: [randomUUID()],
      revision: 1,
      state: { state: "state" },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve existing causation", async () => {
    const repository = connection.getRepository(SagaCausationEntity);

    const event = new DomainEvent(TEST_COMMAND);

    await repository.insert({
      saga_id: sagaIdentifier.id,
      saga_name: sagaIdentifier.name,
      saga_context: sagaIdentifier.context,
      causation_id: event.id,
    });

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
    const repository = connection.getRepository(SagaEntity);

    await repository.save({ ...attributes });

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

    await expect(repository.findOneBy(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        messages_to_dispatch: [],
        revision: 2,
      }),
    );
  });

  test("should clear processed causation ids", async () => {
    const repository = connection.getRepository(SagaEntity);

    await repository.save({ ...attributes });

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

    await expect(store.clearProcessedCausationIds(filter, update)).resolves.toBeUndefined();

    await expect(repository.findOneBy(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    );
  });

  test("should find saga", async () => {
    const repository = connection.getRepository(SagaEntity);

    await repository.save({ ...attributes });

    await expect(store.find(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert saga", async () => {
    const repository = connection.getRepository(SagaEntity);

    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(repository.findOneBy(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert processed causation ids", async () => {
    const repository = connection.getRepository(SagaCausationEntity);

    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(sagaIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      repository.findBy({
        saga_id: sagaIdentifier.id,
        saga_name: sagaIdentifier.name,
        saga_context: sagaIdentifier.context,
      }),
    ).resolves.toStrictEqual([
      expect.objectContaining({ causation_id: one }),
      expect.objectContaining({ causation_id: two }),
      expect.objectContaining({ causation_id: three }),
    ]);
  });

  test("should update saga", async () => {
    const repository = connection.getRepository(SagaEntity);

    await repository.save({ ...attributes });

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

    await expect(repository.findOneBy(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
