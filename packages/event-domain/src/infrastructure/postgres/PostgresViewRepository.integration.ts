import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresViewRepository } from "./PostgresViewRepository";
import { ViewIdentifier } from "../../types";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { createViewEntities } from "../../util";

describe("PostgresViewRepository", () => {
  const logger = createMockLogger();
  const { ViewEntity } = createViewEntities("PostgresViewRepository");

  let connection: PostgresConnection;
  let repository: PostgresViewRepository;
  let view: ViewIdentifier;

  let view1: string;
  let view2: string;
  let view3: string;

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

    view = { context: "view_repository", name: "view_name", id: randomUUID() };

    repository = new PostgresViewRepository({ connection, viewEntity: ViewEntity }, logger);

    await connection.connect();

    const repo = connection.getRepository(ViewEntity);

    view1 = randomUUID();
    view2 = randomUUID();
    view3 = randomUUID();

    await repo.save({
      id: view1,
      name: view.name,
      context: view.context,
      destroyed: false,
      meta: {},
      revision: 1,
      state: { one: 1, common: "common" },
    });
    await repo.save({
      id: view2,
      name: view.name,
      context: view.context,
      destroyed: false,
      meta: {},
      revision: 2,
      state: { two: 2, common: "common" },
    });
    await repo.save({
      id: view3,
      name: view.name,
      context: view.context,
      destroyed: false,
      meta: {},
      revision: 3,
      state: { three: 3, common: "uncommon" },
    });
    await repo.save({
      id: randomUUID(),
      name: view.name,
      context: view.context,
      destroyed: true,
      meta: {},
      revision: 4,
      state: { four: 4, common: "common" },
    });
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find", async () => {
    await expect(repository.find({})).resolves.toStrictEqual([
      {
        id: view1,
        name: view.name,
        context: view.context,
        revision: 1,
        state: { one: 1, common: "common" },
        timestamp_modified: expect.any(Date),
      },
      {
        id: view2,
        name: view.name,
        context: view.context,
        revision: 2,
        state: { two: 2, common: "common" },
        timestamp_modified: expect.any(Date),
      },
      {
        id: view3,
        name: view.name,
        context: view.context,
        revision: 3,
        state: { three: 3, common: "uncommon" },
        timestamp_modified: expect.any(Date),
      },
    ]);
  });

  test("should find by id", async () => {
    await expect(repository.findById(view3)).resolves.toStrictEqual({
      id: view3,
      name: view.name,
      context: view.context,
      revision: 3,
      state: { three: 3, common: "uncommon" },
      timestamp_modified: expect.any(Date),
    });
  });

  test("should find one", async () => {
    await expect(repository.findOne({ where: { id: view1 } })).resolves.toStrictEqual({
      id: view1,
      name: view.name,
      context: view.context,
      revision: 1,
      state: { one: 1, common: "common" },
      timestamp_modified: expect.any(Date),
    });
  });
});
