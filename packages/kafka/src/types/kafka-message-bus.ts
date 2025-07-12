import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka, Producer } from "kafkajs";
import { Sqlite } from "../classes/private";

export type KafkaBusOptions<M extends IMessage> = {
  kafka: Kafka;
  logger: ILogger;
  producer: Producer;
  sqlite: Sqlite;
  subscriptions: IMessageSubscriptions;
  target: Constructor<M>;
};
