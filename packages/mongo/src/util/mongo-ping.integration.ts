import { mongoPing } from "./mongo-ping";
import { MongoConnection } from "../infrastructure";
import { Logger, LogLevel } from "@lindorm-io/winston";

describe("mongo-query.ts", () => {
  let connection: MongoConnection;
  let logger: Logger;

  beforeAll(async () => {
    logger = new Logger();
    logger.addConsole(LogLevel.ERROR);

    connection = new MongoConnection({
      host: "localhost",
      port: 27017,
      auth: { username: "root", password: "example" },
      database: "databaseName",
      winston: logger,
    });

    await connection.waitForConnection();
  });

  afterAll(async () => {
    await connection.close();
  });

  test("should ping mongo by trying connect", async () => {
    await expect(mongoPing(connection, logger)).resolves.toBe(true);
  });
});
