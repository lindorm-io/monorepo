import { AmqpConnection } from "@lindorm-io/amqp";
import { MongoConnection } from "@lindorm-io/mongo";
import { PostgresConnection } from "@lindorm-io/postgres";
import { LogLevel, WinstonLogger } from "@lindorm-io/winston";
import { join } from "path";
import { EventSource } from "../src";
import { CreateGreeting } from "./aggregates/greeting/commands/create-greeting.command";
import { UpdateGreeting } from "./aggregates/greeting/commands/update-greeting.command";
import { RespondGreeting } from "./aggregates/response/commands/respond-greeting.command";
import { GetViewFromMongo } from "./queries/get-view-from-mongo.query";
import { GetViewFromPostgres } from "./queries/get-view-from-postgres.query";

const logger = new WinstonLogger();
logger.addConsole(LogLevel.VERBOSE, { colours: true, readable: true, timestamp: true });

const main = async (): Promise<void> => {
  const amqp = new AmqpConnection(
    {
      hostname: "localhost",
      port: 5002,
      connectInterval: 500,
      connectTimeout: 30000,
    },
    logger,
  );

  const mongo = new MongoConnection(
    {
      host: "localhost",
      port: 5004,
      auth: { username: "root", password: "example" },
      authSource: "admin",
      database: "mongo_db",
    },
    logger,
  );

  const postgres = new PostgresConnection(
    {
      host: "localhost",
      port: 5003,
      user: "root",
      password: "example",
      database: "default_db",
    },
    logger,
  );

  const app = new EventSource<CreateGreeting | UpdateGreeting | RespondGreeting>(
    {
      adapters: {
        eventStore: "postgres",
        messageBus: "amqp",
        sagaStore: "postgres",
      },
      aggregates: join(__dirname, "aggregates"),
      connections: { amqp, mongo, postgres },
      queries: join(__dirname, "queries"),
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
      logger.debug("viewChangeCount", { viewChangeCount });

      if (viewChangeCount >= 6) {
        clearInterval(interval);
        resolve(undefined);
      }
    }, 1000);
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
