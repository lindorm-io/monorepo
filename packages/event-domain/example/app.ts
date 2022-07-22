import { AmqpConnection } from "@lindorm-io/amqp";
import { EventDomainApp, ViewRepository } from "../src";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { join } from "path";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

const logger = new Logger();
logger.addConsole(LogLevel.INFO, { colours: true, readable: true, timestamp: true });

const main = async (): Promise<void> => {
  const amqp = new AmqpConnection({
    hostname: "localhost",
    logger,
    port: 5671,
    connectInterval: 500,
    connectTimeout: 30000,
  });

  const mongo = new MongoConnection({
    host: "localhost",
    port: 27015,
    auth: { username: "root", password: "example" },
    logger,
  });

  const app = new EventDomainApp({
    amqp,
    database: "default",
    domain: { directory: join(__dirname) },
    logger,
    mongo,
  });

  app.on("event", (event, view) => {
    logger.info("on:event", { event, view });
  });

  app.on("error", (err: Error) => {
    logger.error("on:error", err);
  });

  const aggregateId = randomUUID();
  const aggregateName = "greeting";

  await app.publish({
    aggregate: { id: aggregateId, name: aggregateName },
    name: "create",
    data: { initial: "Hi" },
  });

  await sleep(2000);

  const result = await app.query(
    { collection: "greetings", database: "default" },
    {
      id: aggregateId,
      name: "greetings",
      context: "default",
    },
  );

  logger.info("query", { result });

  const repository = new ViewRepository({
    collection: "greetings",
    connection: mongo,
    database: "default",
    logger,
    view: { name: "greetings", context: "default" },
  });

  const viewData = await repository.find();

  logger.info("find", { viewData });
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
