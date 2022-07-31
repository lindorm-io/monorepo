import { PostgresConnection } from "@lindorm-io/postgres";
import { SagaCausationEntity } from "./SagaCausation.entity";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";

describe("SagaCausationEntity", () => {
  const logger = createMockLogger();

  let connection: PostgresConnection;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [SagaCausationEntity],
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
    const saga_id = randomUUID();
    const saga_name = "sagaName";
    const saga_context = "sagaContext";
    const causation_id_1 = randomUUID();
    const causation_id_2 = randomUUID();

    await connection.transaction(async (manager) => {
      await manager.getRepository(SagaCausationEntity).save({
        saga_id,
        saga_name,
        saga_context,
        causation_id: causation_id_1,
      });

      await manager.getRepository(SagaCausationEntity).save({
        saga_id,
        saga_name,
        saga_context,
        causation_id: causation_id_2,
      });
    });

    await expect(
      connection.getRepository(SagaCausationEntity).findBy({ saga_id, saga_name, saga_context }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        saga_id,
        saga_name,
        saga_context,
        causation_id: causation_id_1,
        timestamp: expect.any(Date),
      }),
      expect.objectContaining({
        saga_id,
        saga_name,
        saga_context,
        causation_id: causation_id_2,
        timestamp: expect.any(Date),
      }),
    ]);
  }, 10000);
});
