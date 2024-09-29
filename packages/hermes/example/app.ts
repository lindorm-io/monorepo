import { Logger, LogLevel } from "@lindorm/logger";
import { MongoSource } from "@lindorm/mongo";
import { PostgresSource } from "@lindorm/postgres";
import { RabbitSource } from "@lindorm/rabbit";
import { join } from "path";
import { Hermes } from "../src";
import { CreateGreeting } from "./aggregates/greeting/commands/create-greeting.command";
import { UpdateGreeting } from "./aggregates/greeting/commands/update-greeting.command";
import { RespondGreeting } from "./aggregates/response/commands/respond-greeting.command";
import { GetViewFromMongo } from "./queries/get-view-from-mongo.query";
import { GetViewFromPostgres } from "./queries/get-view-from-postgres.query";

const logger = new Logger({ level: LogLevel.Verbose, readable: true });

const main = async (): Promise<void> => {
  const rabbit = new RabbitSource({
    logger,
    url: "amqp://localhost:5672",
  });

  const mongo = new MongoSource({
    database: "Hermes",
    logger,
    url: "mongodb://root:example@localhost/admin?authSource=admin",
  });

  const postgres = new PostgresSource({
    logger,
    url: "postgres://root:example@localhost:5432/default",
  });

  const hermes = new Hermes<CreateGreeting | UpdateGreeting | RespondGreeting>({
    checksumStore: { postgres },
    eventStore: { postgres },
    messageBus: { rabbit },
    sagaStore: { mongo },
    viewStore: { mongo },
    directories: {
      aggregates: join(__dirname, "aggregates"),
      queries: join(__dirname, "queries"),
      sagas: join(__dirname, "sagas"),
      views: join(__dirname, "views"),
    },
    logger,
  });

  await hermes.setup();

  let viewChangeCount = 0;

  hermes.on("view", (data) => {
    logger.verbose("on:view", { data });
    viewChangeCount += 1;
  });

  const { id: aggregateId } = await hermes.command(new CreateGreeting("Hi"));

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

  inspect.greetingAggregate = await hermes.admin.inspect.aggregate({
    id: aggregateId,
    name: "greeting",
  });

  inspect.responseAggregate = await hermes.admin.inspect.aggregate({
    id: aggregateId,
    name: "response",
  });

  inspect.saga = await hermes.admin.inspect.saga({
    id: aggregateId,
    name: "test_saga",
  });

  logger.info("inspect", { inspect });

  const queries: any = {};

  queries.getViewFromMongo = await hermes.query(new GetViewFromMongo(aggregateId));
  queries.getViewFromPostgres = await hermes.query(new GetViewFromPostgres(aggregateId));

  logger.info("queries", { queries });
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
