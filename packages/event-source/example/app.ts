import { AmqpConnection } from "@lindorm-io/amqp";
import { CreateGreeting } from "./aggregates/greeting/commands/create-greeting.command";
import { EventSource } from "../src";
import { GetViewFromMongo } from "./queries/get-view-from-mongo.query";
import { GetViewFromPostgres } from "./queries/get-view-from-postgres.query";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { PostgresConnection } from "@lindorm-io/postgres";
import { RespondGreeting } from "./aggregates/response/commands/respond-greeting.command";
import { UpdateGreeting } from "./aggregates/greeting/commands/update-greeting.command";
import { join } from "path";

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
      authSource: "admin",
      database: "mongo_db",
    },
    logger,
  );

  const postgres = new PostgresConnection(
    {
      host: "localhost",
      port: 5431,
      user: "root",
      password: "example",
      database: "default_db",
    },
    logger,
  );

  const app = new EventSource<CreateGreeting | UpdateGreeting | RespondGreeting>(
    {
      connections: { amqp, mongo, postgres },
      aggregates: join(__dirname, "aggregates"),
      queries: join(__dirname, "queries"),
      adapters: {
        eventStore: "postgres",
        messageBus: "amqp",
        sagaStore: "postgres",
      },
    },
    logger,
  );

  await app.init();

  let viewChangeCount = 0;

  app.on("view", (data) => {
    logger.verbose("on:view", { data });
    viewChangeCount += 1;
  });

  const {
    aggregate: { id: aggregateId },
  } = await app.command(new CreateGreeting("Hi"));

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (viewChangeCount >= 6) {
        clearInterval(interval);
        resolve(undefined);
      }
    }, 250);
  });

  const inspect: any = {};

  inspect.greetingAggregate = await app.admin.inspect.aggregate({
    id: aggregateId,
    name: "greeting",
  });

  inspect.responseAggregate = await app.admin.inspect.aggregate({
    id: aggregateId,
    name: "response",
  });

  inspect.saga = await app.admin.inspect.saga({
    id: aggregateId,
    name: "test_saga",
  });

  logger.info("inspect", { inspect });

  const queries: any = {};

  queries.getViewFromMongo = await app.query(new GetViewFromMongo(aggregateId));
  queries.getViewFromPostgres = await app.query(new GetViewFromPostgres(aggregateId));

  logger.info("queries", { queries });
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
