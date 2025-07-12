import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka, Producer } from "kafkajs";
import { Sqlite } from "../../classes/private";
import { IKafkaMessageBus } from "../../interfaces";

export type FromClone = {
  _mode: "from_clone";
  buses: Map<Constructor<IMessage>, IKafkaMessageBus<IMessage>>;
  kafka: Kafka;
  logger: ILogger;
  messages: Array<Constructor<IMessage>>;
  producer: Producer;
  sqlite: Sqlite;
  subscriptions: IMessageSubscriptions;
};
