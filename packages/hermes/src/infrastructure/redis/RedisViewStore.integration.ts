import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { randomString } from "@lindorm/random";
import { IRedisSource, RedisSource } from "@lindorm/redis";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_VIEW_IDENTIFIER } from "../../__fixtures__/view";
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
import { RedisViewStore } from "./RedisViewStore";

const redisKey = (viewIdentifier: ViewIdentifier): string => {
  return `view:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

const causationKey = (viewIdentifier: ViewIdentifier): string => {
  return `causation:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

const insertView = async (
  source: IRedisSource,
  attributes: ViewStoreAttributes,
): Promise<void> => {
  await source.client.set(redisKey(attributes), JsonKit.stringify(attributes));
};

const insertCausation = async (
  source: IRedisSource,
  attributes: ViewCausationAttributes,
): Promise<void> => {
  await source.client.set(
    causationKey(attributes),
    JSON.stringify([attributes.causation_id]),
  );
};

const findView = async (
  source: IRedisSource,
  identifier: ViewIdentifier,
): Promise<ViewStoreAttributes | undefined> => {
  const result = await source.client.get(redisKey(identifier));
  return result ? JsonKit.parse<any>(result) : undefined;
};

const findCausations = async (
  source: IRedisSource,
  identifier: ViewIdentifier,
): Promise<Array<string>> => {
  const result = await source.client.get(causationKey(identifier));
  return result ? JSON.parse(result) : [];
};

describe("RedisViewStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: ViewStoreAttributes;
  let source: IRedisSource;
  let store: IViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    source = new RedisSource({
      logger: createMockLogger(),
      url: "redis://localhost:6379",
    });

    await source.setup();

    store = new RedisViewStore(source, logger);
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
    await source.disconnect();
  });

  test("should resolve existing causation", async () => {
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    await insertCausation(source, {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      causation_id: event.id,
      timestamp: event.timestamp,
    });

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
    await insertView(source, attributes);

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

    await expect(
      store.clearProcessedCausationIds(filter, update, { type: ViewStoreType.Redis }),
    ).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    );
  });

  test("should find view", async () => {
    await insertView(source, attributes);

    await expect(
      store.find(viewIdentifier, { type: ViewStoreType.Redis }),
    ).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    );
  });

  test("should insert view", async () => {
    await expect(
      store.insert(attributes, { type: ViewStoreType.Redis }),
    ).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual(
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
      findCausations(source, {
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      }),
    ).resolves.toEqual(expect.arrayContaining([one, two, three]));
  });

  test("should update view", async () => {
    await insertView(source, attributes);

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

    await expect(
      store.update(filter, update, { type: ViewStoreType.Redis }),
    ).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual(
      expect.objectContaining({
        hash: update.hash,
        meta: { meta: true },
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
