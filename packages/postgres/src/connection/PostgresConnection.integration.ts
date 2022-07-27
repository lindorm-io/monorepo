import { PostgresConnection } from "./PostgresConnection";
import { createMockLogger } from "@lindorm-io/winston";

describe("PostgresConnection", () => {
  const logger = createMockLogger(console.log);

  let connection: PostgresConnection;

  beforeEach(async () => {
    connection = new PostgresConnection({
      host: "localhost",
      port: 5432,
      username: "root",
      password: "example",
      database: "default",
      logger,
    });

    await connection.connect();
  }, 30000);

  test("should resolve", async () => {
    await expect(connection.isConnected).toBe(true);
  }, 10000);
});
