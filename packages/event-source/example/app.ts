import { AmqpConnection } from "@lindorm-io/amqp";
import { EventEntity, EventSource, SagaCausationEntity, SagaEntity } from "../src";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { PostgresConnection } from "@lindorm-io/postgres";
import { StoredGreeting, StoredGreetingCausation } from "./entities";
import { join } from "path";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

const logger = new Logger();
logger.addConsole(LogLevel.INFO, { colours: true, readable: true, timestamp: true });

const main = async (): Promise<void> => {
  const amqp = new AmqpConnection(
    {
      hostname: "localhost",
      port: 5671,
      connectInterval: 500,
      connectTimeout: 30000,
    },
    logger,
  );

  const mongo = new MongoConnection(
    {
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      database: "default_db",
      authSource: "admin",
    },
    logger,
  );

  const postgres = new PostgresConnection(
    {
      host: "localhost",
      port: 5432,
      username: "root",
      password: "example",
      database: "default_db",
      entities: [
        EventEntity,
        SagaEntity,
        SagaCausationEntity,
        StoredGreeting,
        StoredGreetingCausation,
      ],
      synchronize: true,
    },
    logger,
  );

  const app = new EventSource(
    {
      amqp,
      mongo,
      postgres,
      domain: {
        directory: join(__dirname),
      },
      aggregates: {
        type: "postgres",
      },
      sagas: {
        type: "postgres",
      },
    },
    logger,
  );

  await app.init();

  app.on("view", (data) => {
    logger.verbose("on:view", { data });
  });

  const aggregateId = randomUUID();
  const aggregateName = "greeting";

  await app.publish({
    aggregate: { id: aggregateId, name: aggregateName },
    name: "create",
    data: { initial: "Hi" },
  });

  await sleep(5000);

  const inspect: any = {};

  inspect.greetingAggregate = await app.admin.inspect.aggregate({
    id: aggregateId,
    name: "greeting",
  });

  inspect.responseAggregate = await app.admin.inspect.aggregate({
    id: aggregateId,
    name: "response",
  });

  inspect.saga = await app.admin.inspect.aggregate({
    id: aggregateId,
    name: "log_greetings",
  });

  logger.info("inspect", { inspect });

  const repositories: any = {};

  repositories.savedGreetings = await app.repositories
    .mongo("saved_greetings")
    .findById(aggregateId);

  repositories.storedGreetings = await app.repositories
    .postgres("stored_greetings")
    .findById(aggregateId);

  logger.info("repositories", { repositories });
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
