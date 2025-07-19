import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Producer } from "kafkajs";
import { IKafkaDelayService } from "../interfaces";

export type KafkaPublisherOptions<M extends IMessage> = {
  logger: ILogger;
  producer: Producer;
  delayService: IKafkaDelayService;
  target: Constructor<M>;
};
