import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { randomString } from "@lindorm/random";
import { IRedisSource, RedisSource } from "@lindorm/redis";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { TEST_HERMES_COMMAND } from "../../__fixtures__/hermes-command";
import { TEST_VIEW_IDENTIFIER } from "../../__fixtures__/view";
import { IViewStore } from "../../interfaces";
import { HermesEvent } from "../../messages";
import {
  AggregateIdentifier,
  ViewCausationAttributes,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../../types";
import { RedisViewStore } from "./RedisViewStore";

const redisKey = (viewIdentifier: ViewIdentifier): string => {
  return `view:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

const causationKey = (viewIdentifier: ViewIdentifier): string => {
  return `causation:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
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

const insertView = async (
  source: IRedisSource,
  attributes: ViewStoreAttributes,
): Promise<void> => {
  await source.client.set(redisKey(attributes), JsonKit.stringify(attributes));
};

const findCausations = async (
  source: IRedisSource,
  identifier: ViewIdentifier,
): Promise<Array<string>> => {
  const result = await source.client.get(causationKey(identifier));
  return result ? JSON.parse(result) : [];
};

const findView = async (
  source: IRedisSource,
  identifier: ViewIdentifier,
): Promise<ViewStoreAttributes | undefined> => {
  const result = await source.client.get(redisKey(identifier));
  return result ? JsonKit.parse<any>(result) : undefined;
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

  test("should find causation ids", async () => {
    const event = new HermesEvent(TEST_HERMES_COMMAND);

    await insertCausation(source, {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      causation_id: event.causationId,
      timestamp: event.timestamp,
    });

    await expect(store.findCausationIds(viewIdentifier)).resolves.toEqual([
      event.causationId,
    ]);
  });

  test("should find view", async () => {
    await insertView(source, attributes);

    await expect(store.findView(viewIdentifier)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { data: "state" },
      }),
    );
  });

  test("should insert causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      findCausations(source, {
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      }),
    ).resolves.toEqual(expect.arrayContaining([one, two, three]));
  });

  test("should insert view", async () => {
    await expect(store.insertView(attributes)).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual(
      expect.objectContaining({
        hash: attributes.hash,
        meta: { data: "state" },
        state: { data: "state" },
      }),
    );
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

    const update: ViewUpdateAttributes = {
      destroyed: false,
      hash: randomString(16),
      meta: { meta: true },
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.updateView(filter, update)).resolves.toBeUndefined();

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
