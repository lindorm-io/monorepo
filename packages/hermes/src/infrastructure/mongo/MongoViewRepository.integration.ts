import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { createTestViewIdentifier } from "../../__fixtures__/create-test-view-identifier";
import { IMongoViewRepository } from "../../interfaces";
import { ViewIdentifier, ViewStoreAttributes } from "../../types";
import { getViewStoreName } from "../../utils/private";
import { MongoViewRepository } from "./MongoViewRepository";

describe("MongoViewRepository", () => {
  const namespace = "mon_vie_rep";
  const logger = createMockLogger();

  let repository: IMongoViewRepository;
  let source: IMongoSource;
  let view: ViewIdentifier;

  let view1: string;
  let view2: string;
  let view3: string;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoViewRepository",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    view = createTestViewIdentifier(namespace);

    repository = new MongoViewRepository(source, view, logger);

    const collection = source.database.collection<ViewStoreAttributes>(
      getViewStoreName(view),
    );

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    await collection.insertMany([
      {
        id: view1,
        name: "name",
        context: namespace,
        destroyed: false,
        processed_causation_ids: [],
        meta: {},
        revision: 1,
        state: { one: 1, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: view2,
        name: "name",
        context: namespace,
        destroyed: false,
        processed_causation_ids: [],
        meta: {},
        revision: 2,
        state: { two: 2, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: view3,
        name: "name",
        context: namespace,
        destroyed: false,
        processed_causation_ids: [],
        meta: {},
        revision: 3,
        state: { three: 3, common: "uncommon" },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: randomUUID(),
        name: "name",
        context: namespace,
        destroyed: true,
        processed_causation_ids: [],
        meta: {},
        revision: 4,
        state: { four: 4, common: "common" },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }, 30000);

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find", async () => {
    await expect(repository.find({ "state.common": "common" })).resolves.toEqual(
      expect.arrayContaining([
        {
          id: view1,
          state: { one: 1, common: "common" },
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: view2,
          state: { two: 2, common: "common" },
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]),
    );
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toEqual({
      id: view3,
      state: { three: 3, common: "uncommon" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(repository.findOne({ id: view1 })).resolves.toEqual({
      id: view1,
      state: { one: 1, common: "common" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });
});
