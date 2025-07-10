import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { IRedisSource, RedisSource } from "@lindorm/redis";
import { randomUUID } from "crypto";
import { createTestEvent } from "../../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { createTestViewIdentifier } from "../../__fixtures__/create-test-view-identifier";
import { TestEventCreate } from "../../__fixtures__/modules/events/TestEventCreate";
import { IViewStore } from "../../interfaces";
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
  return `view:${viewIdentifier.namespace}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

const causationKey = (viewIdentifier: ViewIdentifier): string => {
  return `causation:${viewIdentifier.namespace}:${viewIdentifier.name}:${viewIdentifier.id}`;
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
  const namespace = "red_vie_sto";
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
    aggregateIdentifier = createTestAggregateIdentifier(namespace);
    viewIdentifier = {
      ...createTestViewIdentifier(namespace),
      id: aggregateIdentifier.id,
    };
    attributes = {
      ...viewIdentifier,
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

    await insertCausation(source, {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      namespace: viewIdentifier.namespace,
      causation_id: event.causationId,
      created_at: new Date(),
    });

    await expect(store.findCausationIds(viewIdentifier)).resolves.toEqual([
      event.causationId,
    ]);
  });

  test("should find view", async () => {
    await insertView(source, attributes);

    await expect(store.findView(viewIdentifier)).resolves.toEqual(
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
      store.insertCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    await expect(
      findCausations(source, {
        id: viewIdentifier.id,
        name: viewIdentifier.name,
        namespace: viewIdentifier.namespace,
      }),
    ).resolves.toEqual(expect.arrayContaining([one, two, three]));
  });

  test("should insert view", async () => {
    await expect(store.insertView(attributes)).resolves.toBeUndefined();

    await expect(findView(source, attributes)).resolves.toEqual(
      expect.objectContaining({
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
      namespace: attributes.namespace,
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

    await expect(findView(source, attributes)).resolves.toEqual(
      expect.objectContaining({
        meta: { meta: true },
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
