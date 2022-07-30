import { PostgresConnection } from "@lindorm-io/postgres";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { createViewEntities } from "../../../util";

describe("ViewCausationEntity", () => {
  const logger = createMockLogger();
  const { ViewCausationEntity } = createViewEntities("ViewCausationEntity");

  let connection: PostgresConnection;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [ViewCausationEntity],
        synchronize: true,
      },
      logger,
    );

    await connection.connect();
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save causation entity", async () => {
    const view_id = randomUUID();
    const view_name = "viewName";
    const view_context = "viewContext";
    const causation_id_1 = randomUUID();
    const causation_id_2 = randomUUID();

    await connection.transaction(async (manager) => {
      await manager.getRepository(ViewCausationEntity).save({
        view_id,
        view_name,
        view_context,
        causation_id: causation_id_1,
      });

      await manager.getRepository(ViewCausationEntity).save({
        view_id,
        view_name,
        view_context,
        causation_id: causation_id_2,
      });
    });

    await expect(
      connection.getRepository(ViewCausationEntity).findBy({ view_id, view_name, view_context }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        view_id,
        view_name,
        view_context,
        causation_id: causation_id_1,
        timestamp: expect.any(Date),
      }),
      expect.objectContaining({
        view_id,
        view_name,
        view_context,
        causation_id: causation_id_2,
        timestamp: expect.any(Date),
      }),
    ]);
  }, 10000);
});
