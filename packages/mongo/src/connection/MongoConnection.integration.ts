import { MongoConnection } from "./MongoConnection";
import { createMockLogger } from "@lindorm-io/winston";

describe("MongoConnection", () => {
  test("should connect", async () => {
    const connection = new MongoConnection(
      {
        host: "localhost",
        port: 27017,
        database: "LindormRepository",
        auth: { username: "root", password: "example" },
      },
      createMockLogger(),
    );

    await expect(connection.connect()).resolves.not.toThrow();
  });
});
