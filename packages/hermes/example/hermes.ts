import { Logger, LogLevel } from "@lindorm/logger";
import { MongoSource } from "@lindorm/mongo";
import { PostgresSource } from "@lindorm/postgres";
import { RabbitSource } from "@lindorm/rabbit";
import { RedisSource } from "@lindorm/redis";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { Hermes } from "../src";
import { TestCommandCreate } from "../src/__fixtures__/modules/commands/TestCommandCreate";
import { TestCommandDispatch } from "../src/__fixtures__/modules/commands/TestCommandDispatch";
import { ExampleMongoQuery } from "./modules/queries/ExampleQueryMongo";
import { ExamplePostgresQuery } from "./modules/queries/ExampleQueryPostgres";
import { ExampleRedisQuery } from "./modules/queries/ExampleQueryRedis";

const logger = new Logger({ level: LogLevel.Verbose, readable: true });

const main = async (): Promise<void> => {
  const mongo = new MongoSource({
    database: "Hermes",
    logger,
    url: "mongodb://root:example@localhost/admin?authSource=admin",
  });

  const postgres = new PostgresSource({
    logger,
    url: "postgres://root:example@localhost:5432/default",
  });

  const rabbit = new RabbitSource({
    logger,
    url: "amqp://localhost:5672",
  });

  const redis = new RedisSource({
    logger,
    url: "redis://localhost:6379",
  });

  const hermes = new Hermes({
    checksumStore: { postgres },
    encryptionStore: { postgres },
    eventStore: { postgres },
    messageBus: { rabbit },
    sagaStore: { mongo },
    viewStore: { mongo, postgres, redis },
    modules: [__dirname, "modules"],
    namespace: "example",
    logger,
  });

  await hermes.setup();

  let viewChangeCount = 0;

  hermes.on("view", (data) => {
    logger.verbose("on:view", { data });
    viewChangeCount += 1;
  });

  const id = randomUUID();

  await hermes.command(new TestCommandCreate("create"), { id });

  await sleep(500);

  await hermes.command(new TestCommandDispatch("dispatch"), { id });

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      logger.debug("viewChangeCount", { viewChangeCount });

      if (viewChangeCount >= 9) {
        clearInterval(interval);
        resolve(undefined);
      }
    }, 1000);
  });

  const inspect: any = {};
  const queries: any = {};

  inspect.aggregate = await hermes.admin.inspect.aggregate({
    id,
    name: "example_aggregate",
  });
  inspect.saga = await hermes.admin.inspect.saga({
    id,
    name: "example_saga",
  });

  queries.mongo = await hermes.query(new ExampleMongoQuery(id));
  queries.postgres = await hermes.query(new ExamplePostgresQuery(id));
  queries.redis = await hermes.query(new ExampleRedisQuery(id));

  logger.info("inspect", { inspect });
  logger.info("queries", { queries });

  await Promise.all([
    mongo.disconnect(),
    postgres.disconnect(),
    rabbit.disconnect(),
    redis.disconnect(),
  ]);
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
