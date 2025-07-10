import { Logger, LogLevel } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { IRedisSource, RedisSource } from "@lindorm/redis";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { join } from "path";
import { TestCommandCreate } from "../__fixtures__/modules/commands/TestCommandCreate";
import { TestCommandDispatch } from "../__fixtures__/modules/commands/TestCommandDispatch";
import { TestMongoQuery } from "../__fixtures__/modules/queries/TestQueryMongo";
import { TestPostgresQuery } from "../__fixtures__/modules/queries/TestQueryPostgres";
import { TestRedisQuery } from "../__fixtures__/modules/queries/TestQueryRedis";
import { IHermes } from "../interfaces";
import { HermesEvent } from "../messages";
import { Hermes } from "./Hermes";

describe("Hermes", () => {
  const namespace = "hermes_int";
  const logger = new Logger({ level: LogLevel.Warn, readable: true });

  let mongo: IMongoSource;
  let postgres: IPostgresSource;
  let rabbit: IRabbitSource;
  let redis: IRedisSource;
  let hermes: IHermes;

  let onSagaSpy: jest.Mock;
  let onViewSpy: jest.Mock;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "Hermes",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    postgres = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    rabbit = new RabbitSource({
      logger,
      url: "amqp://localhost:5672",
    });

    redis = new RedisSource({
      logger,
      url: "redis://localhost:6379",
    });

    await Promise.all([mongo.setup(), postgres.setup(), rabbit.setup(), redis.setup()]);

    hermes = new Hermes({
      checksumStore: { mongo },
      encryptionStore: { mongo },
      eventStore: { mongo },
      messageBus: { rabbit },
      sagaStore: { mongo },
      viewStore: { mongo, postgres, redis },
      logger,
      modules: [join(__dirname, "..", "__fixtures__", "modules")],
      namespace,
    });

    onSagaSpy = jest.fn();
    onViewSpy = jest.fn();

    await hermes.setup();
  }, 30000);

  afterAll(async () => {
    await Promise.all([
      mongo.disconnect(),
      postgres.disconnect(),
      rabbit.disconnect(),
      redis.disconnect(),
    ]);
  });

  test("should publish", async () => {
    const id = randomUUID();

    let sagaChangeCount = 0;
    let viewChangeCount = 0;

    hermes.on("saga", () => {
      onSagaSpy();
      sagaChangeCount += 1;
    });

    hermes.on("view", () => {
      onViewSpy();
      viewChangeCount += 1;
    });

    await hermes.command(new TestCommandCreate("create"), { id });

    await sleep(500);

    await hermes.command(new TestCommandDispatch("dispatch"), { id });

    let running = true;

    while (running) {
      if (sagaChangeCount >= 3 && viewChangeCount >= 9) {
        const [s, m, p, r] = await Promise.all([
          hermes.admin.inspect.saga({ id, name: "test_saga", namespace: namespace }),
          hermes.admin.inspect.view({
            id,
            name: "test_mongo_view",
            namespace: namespace,
          }),
          hermes.admin.inspect.view({
            id,
            name: "test_postgres_view",
            namespace: namespace,
          }),
          hermes.admin.inspect.view({
            id,
            name: "test_redis_view",
            namespace: namespace,
          }),
        ]);

        const done =
          s.revision >= 7 && m.revision >= 6 && p.revision >= 6 && r.revision >= 6;

        running = !done;
      }

      if (!running) {
        break;
      }

      await sleep(1000);
    }

    await expect(
      hermes.admin.inspect.aggregate({
        id,
        name: "test_aggregate",
        namespace: namespace,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_aggregate",
        namespace: namespace,
        destroyed: false,
        events: [
          expect.any(HermesEvent),
          expect.any(HermesEvent),
          expect.any(HermesEvent),
        ],
        numberOfLoadedEvents: 3,
        state: {
          create: "create",
          dispatch: "dispatch",
          mergeState: "merge state",
        },
      }),
    );

    await expect(hermes.admin.inspect.saga({ id, name: "test_saga" })).resolves.toEqual(
      expect.objectContaining({
        id: id,
        name: "test_saga",
        namespace: namespace,
        processedCausationIds: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 7,
        state: {
          create: "create",
          dispatch: "dispatch",
          mergeState: "merge state",
        },
      }),
    );

    await expect(
      hermes.admin.inspect.view({ id, name: "test_mongo_view" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_mongo_view",
        namespace: namespace,
        destroyed: false,
        meta: {
          create: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "create",
          },
          dispatch: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "dispatch",
          },
          mergeState: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "merge state",
          },
        },
        processedCausationIds: [],
        revision: 6,
        state: {
          create: "create",
          dispatch: "dispatch",
          mergeState: "merge state",
        },
      }),
    );

    await expect(
      hermes.admin.inspect.view({ id, name: "test_postgres_view" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_postgres_view",
        namespace: namespace,
        destroyed: false,
        meta: {
          create: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "create",
          },
          dispatch: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "dispatch",
          },
          mergeState: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "merge state",
          },
        },
        processedCausationIds: [],
        revision: 6,
        state: {
          create: "create",
          dispatch: "dispatch",
          mergeState: "merge state",
        },
      }),
    );

    await expect(
      hermes.admin.inspect.view({ id, name: "test_redis_view" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_redis_view",
        namespace: namespace,
        destroyed: false,
        meta: {
          create: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "create",
          },
          dispatch: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "dispatch",
          },
          mergeState: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: "merge state",
          },
        },
        processedCausationIds: [],
        revision: 6,
        state: {
          create: "create",
          dispatch: "dispatch",
          mergeState: "merge state",
        },
      }),
    );

    await expect(hermes.query(new TestMongoQuery(id))).resolves.toEqual({
      id,
      state: {
        create: "create",
        dispatch: "dispatch",
        mergeState: "merge state",
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    await expect(hermes.query(new TestPostgresQuery(id))).resolves.toEqual({
      id,
      state: {
        create: "create",
        dispatch: "dispatch",
        mergeState: "merge state",
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    await expect(hermes.query(new TestRedisQuery(id))).resolves.toEqual({
      id,
      state: {
        create: "create",
        dispatch: "dispatch",
        mergeState: "merge state",
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    expect(onSagaSpy).toHaveBeenCalledTimes(3);
    expect(onViewSpy).toHaveBeenCalledTimes(9);
  }, 30000);
});
