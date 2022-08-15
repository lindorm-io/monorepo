import { RedisConnection } from "@lindorm-io/redis";
import { RedisViewRepository } from "./RedisViewRepository";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { ViewIdentifier, HandlerIdentifier, RedisViewStoreAttributes } from "../../types";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { snakeCase } from "lodash";
import { stringifyBlob } from "@lindorm-io/string-blob";

const getKey = (identifier: ViewIdentifier): string =>
  `${snakeCase(identifier.context)}::${snakeCase(identifier.name)}::item::${identifier.id}`;

const getIndex = (identifier: HandlerIdentifier): string =>
  `${snakeCase(identifier.context)}::${snakeCase(identifier.name)}::index`;

describe("RedisViewRepository", () => {
  const logger = createMockLogger();

  let connection: RedisConnection;
  let repository: RedisViewRepository;
  let view: ViewIdentifier;

  let view1: string;
  let view2: string;
  let view3: string;

  beforeAll(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 6371,
      },
      logger,
    );

    view = { ...TEST_VIEW_IDENTIFIER, id: randomUUID() };

    repository = new RedisViewRepository(
      {
        connection,
        view: {
          name: view.name,
          context: view.context,
        },
      },
      logger,
    );

    await connection.connect();

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    const destroyed = randomUUID();

    await connection.client.set(
      getKey({ ...view, id: view1 }),
      stringifyBlob<RedisViewStoreAttributes>({
        id: view1,
        name: view.name,
        context: view.context,
        causation_list: [],
        destroyed: false,
        meta: {},
        revision: 1,
        state: { one: 1, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      }),
    );
    await connection.client.set(
      getKey({ ...view, id: view2 }),
      stringifyBlob<RedisViewStoreAttributes>({
        id: view2,
        name: view.name,
        context: view.context,
        causation_list: [],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { two: 2, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      }),
    );
    await connection.client.set(
      getKey({ ...view, id: view3 }),
      stringifyBlob<RedisViewStoreAttributes>({
        id: view3,
        name: view.name,
        context: view.context,
        causation_list: [],
        destroyed: false,
        meta: {},
        revision: 3,
        state: { three: 3, common: "uncommon" },
        created_at: new Date(),
        updated_at: new Date(),
      }),
    );
    await connection.client.set(
      getKey({ ...view, id: destroyed }),
      stringifyBlob<RedisViewStoreAttributes>({
        id: randomUUID(),
        name: view.name,
        context: view.context,
        causation_list: [],
        destroyed: true,
        meta: {},
        revision: 4,
        state: { four: 4, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      }),
    );

    await connection.client.set(getIndex(view), JSON.stringify([view1, view2, view3, destroyed]));
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find", async () => {
    await expect(repository.find({ state: { common: "common" } })).resolves.toStrictEqual([
      {
        id: view1,
        name: view.name,
        context: view.context,
        revision: 1,
        state: { one: 1, common: "common" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
      {
        id: view2,
        name: view.name,
        context: view.context,
        revision: 2,
        state: { two: 2, common: "common" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toStrictEqual({
      id: view3,
      name: view.name,
      context: view.context,
      revision: 3,
      state: { three: 3, common: "uncommon" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(repository.findOne({ id: view1 })).resolves.toStrictEqual({
      id: view1,
      name: view.name,
      context: view.context,
      revision: 1,
      state: { one: 1, common: "common" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });
});
