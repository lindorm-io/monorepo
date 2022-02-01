import { mongoQuery } from "./mongo-query";
import { logger } from "../test";
import { MongoConnection } from "../infrastructure";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require("mongo-mock");

describe("mongoQuery", () => {
  let connection: MongoConnection;
  let callback: any;

  beforeAll(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27017,
      auth: { username: "root", password: "example" },
      database: "databaseName",
      winston: logger,
      customClient: mock.MongoClient,
    });

    await connection.waitForConnection();
  });

  beforeEach(() => {
    callback = jest.fn();
  });

  afterAll(async () => {
    await connection.close();
  });

  test("should connect to mongo and use callback", async () => {
    await expect(mongoQuery(connection, logger, callback)).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalled();
  });
});
