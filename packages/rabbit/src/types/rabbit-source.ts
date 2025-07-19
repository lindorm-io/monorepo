import { ILogger } from "@lindorm/logger";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { Options } from "amqplib";

export type WithLoggerOptions = {
  logger?: ILogger;
};

export type RabbitSourceMessageBusOptions = WithLoggerOptions & {
  nackTimeout?: number;
};

export type RabbitSourceOptions = {
  config?: Options.Connect;
  connectInterval?: number;
  connectTimeout?: number;
  deadletters?: string;
  exchange?: string;
  logger: ILogger;
  messages?: MessageScannerInput<IMessage>;
  nackTimeout?: number;
  url: string;
};
