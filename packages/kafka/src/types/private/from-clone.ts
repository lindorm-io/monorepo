import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka, Producer } from "kafkajs";
import { IKafkaDelayService, IKafkaMessageBus } from "../../interfaces";

export type FromClone = {
  _mode: "from_clone";
  buses: Map<Constructor<IMessage>, IKafkaMessageBus<IMessage>>;
  delayService: IKafkaDelayService;
  kafka: Kafka;
  logger: ILogger;
  messages: Array<Constructor<IMessage>>;
  producer: Producer;
  subscriptions: IMessageSubscriptions;
};
