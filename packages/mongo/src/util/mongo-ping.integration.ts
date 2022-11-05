import { MongoConnection } from "../connection";
import { createMockLogger } from "@lindorm-io/winston";
import { mongoPing } from "./mongo-ping";

describe("mongoPing", () => {
  let connection: MongoConnection;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 5008,
        database: "MongoPing",
        auth: { username: "root", password: "example" },
      },
      logger,
    );

    await connection.connect();
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should ping mongo by trying connect", async () => {
    await expect(mongoPing(connection, logger)).resolves.toBe(true);
  });
});
