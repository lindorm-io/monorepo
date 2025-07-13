import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka, Producer } from "kafkajs";
import { IKafkaDelayService } from "../interfaces";

export type KafkaBusOptions<M extends IMessage> = {
  kafka: Kafka;
  logger: ILogger;
  producer: Producer;
  delayService: IKafkaDelayService;
  subscriptions: IMessageSubscriptions;
  target: Constructor<M>;
};
