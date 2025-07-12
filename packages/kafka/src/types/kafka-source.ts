import { ILogger } from "@lindorm/logger";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { KafkaConfig } from "kafkajs";

export type KafkaSourceMessageBusOptions = {
  logger?: ILogger;
};

export type CloneKafkaSourceOptions = {
  logger?: ILogger;
};

export type KafkaSourceOptions = {
  config?: Omit<KafkaConfig, "brokers">;
  logger: ILogger;
  messages?: MessageScannerInput<IMessage>;
  brokers: Array<string>;
};
