import { AmqpConnection } from "@lindorm-io/amqp";
import { EventDomainApp } from "../src";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { join } from "path";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";

const logger = new Logger();
logger.addConsole(LogLevel.INFO, { colours: true, readable: true, timestamp: true });

type Caches = "greetings";
type Views = "greetings";

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
    port: 27011,
    auth: { username: "root", password: "example" },
    logger,
  });

  const redis = new RedisConnection({
    host: "localhost",
    port: 6371,
    logger,
  });

  const app = new EventDomainApp<Caches, Views>({
    amqp,
    mongo,
    redis,
    logger,
    domain: {
      database: "default",
      directory: join(__dirname),
    },
  });

  app.on("view", (view) => {
    logger.info("on:view", { view });
  });
  app.on("cache", (cache) => {
    logger.info("on:cache", { cache });
  });

  const aggregateId = randomUUID();
  const aggregateName = "greeting";

  await app.publish({
    aggregate: { id: aggregateId, name: aggregateName },
    name: "create",
    data: { initial: "Hi" },
  });

  await sleep(2000);

  const result = await app.admin.query(
    { collection: "greetings", database: "default" },
    {
      id: aggregateId,
      name: "greetings",
      context: "default",
    },
  );

  logger.info("query", { result });

  const example: any = {};

  example.get = await app.caches.greetings.get(aggregateId);
  example.getAll = await app.caches.greetings.getAll();
  example.count = await app.views.greetings.count();
  example.find = await app.views.greetings.find();
  example.findOne = await app.views.greetings.findOne({ id: aggregateId });

  logger.info("find", { example });
};

main()
  .then()
  .catch((err) => logger.error("error", err))
  .finally(() => process.exit(0));
