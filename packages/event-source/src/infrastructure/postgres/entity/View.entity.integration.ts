import { PostgresConnection } from "@lindorm-io/postgres";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { createViewEntities } from "../../../util";

describe("ViewEntity", () => {
  const logger = createMockLogger();
  const { ViewEntity } = createViewEntities("ViewCausationEntity");

  let connection: PostgresConnection;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [ViewEntity],
        synchronize: true,
      },
      logger,
    );

    await connection.connect();
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save saga entity", async () => {
    const id = randomUUID();
    const name = "sagaName";
    const context = "sagaContext";
    const meta = { meta: 1 };
    const state = { one: 1 };

    await connection.transaction(async (manager) => {
      const saga = await manager.getRepository(ViewEntity).save({
        id,
        name,
        context,
        destroyed: false,
        meta,
        state,
      });

      saga.state.two = 2;

      await manager.getRepository(ViewEntity).update(
        {
          id,
          name,
          context,
          revision: saga.revision,
        },
        {
          state: saga.state,
        },
      );
    });

    await expect(
      connection.getRepository(ViewEntity).findOneBy({ id, name, context }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name,
        context,
        destroyed: false,
        meta: { meta: 1 },
        revision: 2,
        state: {
          one: 1,
          two: 2,
        },
        timestamp: expect.any(Date),
        timestamp_modified: expect.any(Date),
      }),
    );
  }, 10000);
});
