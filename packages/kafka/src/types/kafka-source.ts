import { ILogger } from "@lindorm/logger";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { KafkaConfig } from "kafkajs";
import { KafkaDelayServiceOptions } from "./delay";

export type WithLoggerOptions = {
  logger?: ILogger;
};

export type KafkaSourceOptions = {
  delay?: Omit<KafkaDelayServiceOptions, "logger">;
  config?: Omit<KafkaConfig, "brokers">;
  logger: ILogger;
  messages?: MessageScannerInput<IMessage>;
  brokers: Array<string>;
};
