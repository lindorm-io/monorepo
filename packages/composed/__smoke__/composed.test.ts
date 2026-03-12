import { Client } from "pg";

describe("postgres integration", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      host: "localhost",
      port: 5432,
      user: "root",
      password: "example",
      database: "default",
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  test("should connect and return current database", async () => {
    const result = await client.query("SELECT current_database()");

    expect(result.rows[0].current_database).toBe("default");
  });
});
