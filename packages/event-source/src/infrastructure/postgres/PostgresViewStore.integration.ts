import { DomainEvent } from "../../message";
import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresViewStore } from "./PostgresViewStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { ViewCausationEntity } from "./entity";
import { createMockLogger } from "@lindorm-io/winston";
import { createTypeormViewEntity } from "../../util";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  AggregateIdentifier,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapters,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

describe("PostgresViewStore", () => {
  const logger = createMockLogger();
  const ViewEntity = createTypeormViewEntity(
    TEST_VIEW_IDENTIFIER.name,
    TEST_VIEW_IDENTIFIER.context,
  );
  const adapterOptions: ViewEventHandlerAdapters = { postgres: { ViewEntity } };

  let aggregateIdentifier: AggregateIdentifier;
  let connection: PostgresConnection;
  let store: PostgresViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [ViewEntity, ViewCausationEntity],
        synchronize: true,
      },
      logger,
    );
    await connection.connect();

    store = new PostgresViewStore(connection, logger);
  }, 30000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve existing causation", async () => {
    const repository = connection.getRepository(ViewCausationEntity);

    const command = new DomainEvent(TEST_COMMAND);

    await repository.insert({
      view_id: viewIdentifier.id,
      view_name: viewIdentifier.name,
      view_context: viewIdentifier.context,
      causation_id: command.id,
    });

    await expect(store.causationExists(viewIdentifier, command)).resolves.toBe(true);

    await expect(
      store.causationExists(
        {
          ...viewIdentifier,
          id: randomUUID(),
        },
        command,
      ),
    ).resolves.toBe(false);
  });

  test("should clear processed causation ids", async () => {
    const repository = connection.getRepository(ViewEntity);

    const entity = repository.create({
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: ["processed"],
      revision: 1,
      state: {},
    });

    await repository.save(entity);

    const filter: ViewUpdateFilter = {
      id: entity.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      hash: entity.hash,
      revision: entity.revision,
    };

    const update: ViewClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(
      store.clearProcessedCausationIds(filter, update, adapterOptions),
    ).resolves.toBeUndefined();

    await expect(repository.findOneBy(viewIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    );
  });

  test("should find view", async () => {
    const repository = connection.getRepository(ViewEntity);

    const entity = repository.create({
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { found: true },
    });

    await repository.save(entity);

    await expect(store.find(viewIdentifier, adapterOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: entity.hash,
        state: { found: true },
      }),
    );
  });

  test("should insert view", async () => {
    const repository = connection.getRepository(ViewEntity);

    const data: ViewStoreAttributes = {
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

    await expect(store.insert(data, adapterOptions)).resolves.toBeUndefined();

    await expect(repository.findOneBy(viewIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: data.hash,
        state: { inserted: true },
      }),
    );
  });

  test("should insert processed causation ids", async () => {
    const repository = connection.getRepository(ViewCausationEntity);

    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      repository.findBy({
        view_id: viewIdentifier.id,
        view_name: viewIdentifier.name,
        view_context: viewIdentifier.context,
      }),
    ).resolves.toStrictEqual([
      expect.objectContaining({ causation_id: one }),
      expect.objectContaining({ causation_id: two }),
      expect.objectContaining({ causation_id: three }),
    ]);
  });

  test("should update view", async () => {
    const repository = connection.getRepository(ViewEntity);

    const entity = repository.create({
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { found: true },
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repository.save(entity);

    const filter: ViewUpdateFilter = {
      id: entity.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      hash: entity.hash,
      revision: entity.revision,
    };

    const update: ViewUpdateData = {
      destroyed: false,
      hash: randomString(16),
      meta: { meta: true },
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.update(filter, update, adapterOptions)).resolves.toBeUndefined();

    await expect(repository.findOneBy(viewIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        meta: { meta: true },
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
