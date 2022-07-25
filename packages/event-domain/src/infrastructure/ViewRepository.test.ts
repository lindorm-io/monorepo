import { MongoConnection } from "@lindorm-io/mongo";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { ViewIdentifier, ViewStoreAttributes } from "../types";
import { ViewRepository } from "./ViewRepository";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";

const mock = require("mongo-mock");

describe("ViewRepository", () => {
  const logger = createMockLogger();

  let connection: MongoConnection;
  let repository: ViewRepository<any>;
  let view: ViewIdentifier;

  let view1: string;
  let view2: string;
  let view3: string;

  beforeAll(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      logger,
      database: "db",
      custom: mock.MongoClient,
    });

    view = { ...TEST_VIEW_IDENTIFIER, id: randomUUID() };

    repository = new ViewRepository({
      connection,
      logger,
      view: {
        name: view.name,
        context: view.context,
      },
    });

    await connection.connect();

    const collection = connection.client.db("db").collection<ViewStoreAttributes>(view.name);

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    await collection.insertMany([
      {
        id: view1,
        name: view.name,
        context: view.context,
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 1,
        state: { one: 1 },
        timeModified: new Date(),
        timestamp: new Date(),
      },
      {
        id: view2,
        name: view.name,
        context: view.context,
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { two: 2 },
        timeModified: new Date(),
        timestamp: new Date(),
      },
      {
        id: view3,
        name: view.name,
        context: view.context,
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 3,
        state: { three: 3 },
        timeModified: new Date(),
        timestamp: new Date(),
      },
      {
        id: randomUUID(),
        name: view.name,
        context: view.context,
        causationList: [],
        destroyed: true,
        meta: {},
        revision: 4,
        state: { four: 4 },
        timeModified: new Date(),
        timestamp: new Date(),
      },
    ]);
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve amount of view data", async () => {
    await expect(repository.count()).resolves.toStrictEqual(3);
  });

  test("should resolve array of view data", async () => {
    await expect(repository.find()).resolves.toStrictEqual([
      {
        id: view1,
        revision: 1,
        state: { one: 1 },
        timeModified: expect.any(Date),
      },
      {
        id: view2,
        revision: 2,
        state: { two: 2 },
        timeModified: expect.any(Date),
      },
      {
        id: view3,
        revision: 3,
        state: { three: 3 },
        timeModified: expect.any(Date),
      },
    ]);
  });

  test("should resolve specific view data", async () => {
    await expect(repository.findOne({ id: view1 })).resolves.toStrictEqual({
      id: view1,
      revision: 1,
      state: { one: 1 },
      timeModified: expect.any(Date),
    });
  });
});
