import { MongoConnection } from "../infrastructure";
import { createMockLogger } from "@lindorm-io/winston";
import { mongoQuery } from "./mongo-query";

describe("mongoQuery", () => {
  let connection: MongoConnection;
  let callback: any;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27017,
      auth: { username: "root", password: "example" },
      logger,
    });

    await connection.connect();
  });

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
