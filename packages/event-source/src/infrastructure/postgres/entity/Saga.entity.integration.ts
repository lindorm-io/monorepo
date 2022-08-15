import { Command } from "../../../message";
import { PostgresConnection } from "@lindorm-io/postgres";
import { SagaEntity } from "./Saga.entity";
import { TEST_COMMAND_DISPATCH } from "../../../fixtures/command.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";

describe("SagaEntity", () => {
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
        entities: [SagaEntity],
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
    const messages_to_dispatch = [new Command(TEST_COMMAND_DISPATCH)];
    const state = { one: 1 };

    await connection.transaction(async (manager) => {
      const saga = await manager.getRepository(SagaEntity).save({
        id,
        name,
        context,
        destroyed: false,
        messages_to_dispatch,
        state,
      });

      saga.state.two = 2;

      await manager.getRepository(SagaEntity).update(
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
      connection.getRepository(SagaEntity).findOneBy({ id, name, context }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name,
        context,
        destroyed: false,
        messages_to_dispatch: [
          {
            id: expect.any(String),
            name: "command_dispatch",
            aggregate: {
              id: expect.any(String),
              name: "aggregate_name",
              context: "default",
            },
            causationId: expect.any(String),
            correlationId: expect.any(String),
            data: {
              commandData: true,
            },
            delay: 0,
            mandatory: true,
            origin: "test",
            originator: null,
            timestamp: expect.any(String),
            type: "command",
          },
        ],
        revision: 2,
        state: {
          one: 1,
          two: 2,
        },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      }),
    );
  }, 10000);
});
