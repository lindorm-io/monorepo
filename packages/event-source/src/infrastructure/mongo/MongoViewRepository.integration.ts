import { MongoConnection } from "@lindorm-io/mongo";
import { MongoViewRepository } from "./MongoViewRepository";
import { MongoViewStoreAttributes, ViewIdentifier } from "../../types";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";

describe("MongoViewRepository", () => {
  const logger = createMockLogger();

  let connection: MongoConnection;
  let repository: MongoViewRepository;
  let view: ViewIdentifier;

  let view1: string;
  let view2: string;
  let view3: string;

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 27011,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "MongoViewRepository",
      },
      logger,
    );

    view = { context: "view_repository", name: "view_name", id: randomUUID() };

    repository = new MongoViewRepository(
      { connection, collection: "views_collection", view },
      logger,
    );

    await connection.connect();

    const collection = connection.database.collection<MongoViewStoreAttributes>("views_collection");

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    await collection.insertMany([
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
    ]);
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find", async () => {
    await expect(repository.find({ "state.common": "common" })).resolves.toStrictEqual([
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
