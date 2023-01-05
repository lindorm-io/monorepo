import { MongoConnection } from "../connection";
import { createMockLogger } from "@lindorm-io/core-logger";
import { mongoQuery } from "./mongo-query";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require("mongo-mock");

describe("mongoQuery", () => {
  let connection: MongoConnection;
  let callback: any;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 5008,
        auth: { username: "root", password: "example" },
        database: "MongoQuery",
        custom: mock.MongoClient,
      },
      logger,
    );

    await connection.connect();
  }, 30000);

  beforeEach(() => {
    callback = jest.fn();
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should connect to mongo and use callback", async () => {
    await expect(mongoQuery(connection, logger, callback)).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalled();
  });
});
