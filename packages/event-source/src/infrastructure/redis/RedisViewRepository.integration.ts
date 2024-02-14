import { createMockLogger } from "@lindorm-io/core-logger";
import { randomString } from "@lindorm-io/random";
import { RedisConnection } from "@lindorm-io/redis";
import { stringifyBlob } from "@lindorm-io/string-blob";
import { randomUUID } from "crypto";
import { ViewIdentifier } from "../../types";
import { RedisViewRepository } from "./RedisViewRepository";

const redisKey = (viewIdentifier: ViewIdentifier): string => {
  return `view:${viewIdentifier.context}:${viewIdentifier.name}:${viewIdentifier.id}`;
};

describe("RedisViewRepository", () => {
  const logger = createMockLogger();

  let connection: RedisConnection;
  let identifier: ViewIdentifier;
  let repository: RedisViewRepository;

  let view1: string;
  let view2: string;
  let view3: string;

  beforeAll(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 5012,
      },
      logger,
    );
    await connection.connect();

    identifier = { context: "view_repository", name: "name", id: randomUUID() };

    repository = new RedisViewRepository(connection, identifier, logger);

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    const attributes = [
      {
        id: view1,
        name: "name",
        context: "view_repository",
        destroyed: false,
        processed_causation_ids: [],
        hash: randomString(16),
        meta: {},
        revision: 1,
        state: { one: 1, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: view2,
        name: "name",
        context: "view_repository",
        destroyed: false,
        processed_causation_ids: [],
        hash: randomString(16),
        meta: {},
        revision: 2,
        state: { two: 2, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: view3,
        name: "name",
        context: "view_repository",
        destroyed: false,
        processed_causation_ids: [],
        hash: randomString(16),
        meta: {},
        revision: 3,
        state: { three: 3, common: "uncommon" },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: randomUUID(),
        name: "name",
        context: "view_repository",
        destroyed: true,
        processed_causation_ids: [],
        hash: randomString(16),
        meta: {},
        revision: 4,
        state: { four: 4, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const attribute of attributes) {
      await connection.client.set(redisKey(attribute), stringifyBlob(attribute));
    }
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find", async () => {
    await expect(repository.find({ state: { common: "common" } })).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: view1,
          state: { one: 1, common: "common" },
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        }),
        expect.objectContaining({
          id: view2,
          state: { two: 2, common: "common" },
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        }),
      ]),
    );
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toStrictEqual({
      id: view3,
      state: { three: 3, common: "uncommon" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(repository.findOne({ id: view1 })).resolves.toStrictEqual({
      id: view1,
      state: { one: 1, common: "common" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });
});
