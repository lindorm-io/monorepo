import { createMockLogger } from "@lindorm-io/core-logger";
import { randomString } from "@lindorm-io/random";
import { RedisConnection } from "@lindorm-io/redis";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { DomainEvent } from "../../message";
import {
  AggregateIdentifier,
  ViewCausationAttributes,
  ViewClearProcessedCausationIdsData,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";
import { RedisViewStore } from "./RedisViewStore";

const redisKey = (viewIdentifier: ViewIdentifier): string => {
  return `view:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

const causationKey = (viewIdentifier: ViewIdentifier): string => {
  return `causation:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

const insertView = async (
  connection: RedisConnection,
  attributes: ViewStoreAttributes,
): Promise<void> => {
  await connection.client.set(redisKey(attributes), stringifyBlob(attributes));
};

const insertCausation = async (
  connection: RedisConnection,
  attributes: ViewCausationAttributes,
): Promise<void> => {
  await connection.client.set(causationKey(attributes), JSON.stringify([attributes.causation_id]));
};

const findView = async (
  connection: RedisConnection,
  identifier: ViewIdentifier,
): Promise<ViewStoreAttributes | undefined> => {
  const result = await connection.client.get(redisKey(identifier));
  return result ? parseBlob(result) : undefined;
};

const findCausations = async (
  connection: RedisConnection,
  identifier: ViewIdentifier,
): Promise<Array<string>> => {
  const result = await connection.client.get(causationKey(identifier));
  return result ? JSON.parse(result) : [];
};

describe("RedisViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let connection: RedisConnection;
  let store: RedisViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 5012,
      },
      logger,
    );
    await connection.connect();

    store = new RedisViewStore(connection, logger);
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
    attributes = {
      ...viewIdentifier,
      destroyed: false,
      hash: randomString(16),
      meta: { data: "state" },
      processed_causation_ids: [randomUUID()],
      revision: 1,
      state: { data: "state" },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new DomainEvent(TEST_COMMAND);

    await insertCausation(connection, {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      causation_id: event.id,
      timestamp: event.timestamp,
    });

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
    await insertView(connection, attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: ViewClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(store.clearProcessedCausationIds(filter, update)).resolves.toBeUndefined();

    await expect(findView(connection, attributes)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    );
  });

  test("should find view", async () => {
    await insertView(connection, attributes);

    await expect(store.find(viewIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    );
  });

  test("should insert view", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(findView(connection, attributes)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        meta: { data: "state" },
        state: { data: "state" },
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

    await expect(
      findCausations(connection, {
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      }),
    ).resolves.toStrictEqual(expect.arrayContaining([one, two, three]));
  });

  test("should update view", async () => {
    await insertView(connection, attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
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

    await expect(store.update(filter, update)).resolves.toBeUndefined();

    await expect(findView(connection, attributes)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        meta: { meta: true },
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
