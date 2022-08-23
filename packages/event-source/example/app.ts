import { AmqpConnection } from "@lindorm-io/amqp";
import { CreateGreeting } from "./aggregates/greeting/commands/create-greeting.command";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { PostgresConnection } from "@lindorm-io/postgres";
import { RespondGreeting } from "./aggregates/response/commands/respond-greeting.command";
import { StoredGreeting } from "./entities";
import { UpdateGreeting } from "./aggregates/greeting/commands/update-greeting.command";
import { join } from "path";
import {
  EventEntity,
  EventSource,
  EventStoreType,
  MessageBusType,
  SagaCausationEntity,
  SagaEntity,
  SagaStoreType,
  ViewCausationEntity,
  ViewStoreType,
} from "../src";

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
      entities: [EventEntity, SagaEntity, SagaCausationEntity, StoredGreeting, ViewCausationEntity],
      synchronize: true,
    },
    logger,
  );

  const app = new EventSource<CreateGreeting | UpdateGreeting | RespondGreeting>(
    {
      connections: {
        amqp,
        mongo,
        postgres,
      },
      directory: join(__dirname, "aggregates"),
      adapters: {
        eventStore: EventStoreType.POSTGRES,
        messageBus: MessageBusType.AMQP,
        sagaStore: SagaStoreType.POSTGRES,
        viewStore: ViewStoreType.POSTGRES,
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
  } = await app.publish(new CreateGreeting("Hi"));

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (viewChangeCount >= 3) {
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

  const repositories: any = {};

  repositories.postgres = await app.repositories
    .postgres("postgres_greetings")
    .findById(aggregateId);

  logger.info("repositories", { repositories });
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
