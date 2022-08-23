import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresViewRepository } from "./PostgresViewRepository";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { ViewIdentifier } from "../../types";
import { createMockLogger } from "@lindorm-io/winston";
import { createTypeormViewEntity } from "../../util";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

describe("PostgresViewRepository", () => {
  const logger = createMockLogger();
  const ViewEntity = createTypeormViewEntity(TEST_VIEW_IDENTIFIER.name, "postgres_view_repository");

  let connection: PostgresConnection;
  let identifier: ViewIdentifier;
  let repository: PostgresViewRepository;

  let view1: string;
  let view2: string;
  let view3: string;
  let view4: string;

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

    identifier = {
      id: randomUUID(),
      name: TEST_VIEW_IDENTIFIER.name,
      context: "postgres_view_repository",
    };

    repository = new PostgresViewRepository({ connection, view: identifier, ViewEntity }, logger);

    await connection.connect();

    const repo = connection.getRepository(ViewEntity);

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();
    view4 = randomUUID();

    await repo.save({
      id: view1,
      name: identifier.name,
      context: identifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { one: 1, common: "common" },
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repo.save({
      id: view2,
      name: identifier.name,
      context: identifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 2,
      state: { two: 2, common: "common" },
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repo.save({
      id: view3,
      name: identifier.name,
      context: identifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 3,
      state: { three: 3, common: "uncommon" },
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repo.save({
      id: view4,
      name: identifier.name,
      context: identifier.context,
      destroyed: true,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 4,
      state: { four: 4, common: "common" },
      created_at: new Date(),
      updated_at: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find", async () => {
    await expect(repository.find({})).resolves.toStrictEqual([
      {
        id: view1,
        name: identifier.name,
        context: identifier.context,
        revision: 1,
        state: { one: 1, common: "common" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
      {
        id: view2,
        name: identifier.name,
        context: identifier.context,
        revision: 2,
        state: { two: 2, common: "common" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
      {
        id: view3,
        name: identifier.name,
        context: identifier.context,
        revision: 3,
        state: { three: 3, common: "uncommon" },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    ]);
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toStrictEqual({
      id: view3,
      name: identifier.name,
      context: identifier.context,
      revision: 3,
      state: { three: 3, common: "uncommon" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(repository.findOne({ where: { id: view1 } })).resolves.toStrictEqual({
      id: view1,
      name: identifier.name,
      context: identifier.context,
      revision: 1,
      state: { one: 1, common: "common" },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
  });
});
