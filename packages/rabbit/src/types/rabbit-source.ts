import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Options } from "amqplib";
import { IRabbitMessage } from "../interfaces";
import { ValidateMessageFn } from "./rabbit-message-bus";

export type RabbitSourceMessage<M extends IRabbitMessage = IRabbitMessage> = {
  Message: Constructor<M>;
  validate?: ValidateMessageFn<M>;
};

export type RabbitSourceMessages = Array<
  Constructor<IRabbitMessage> | RabbitSourceMessage | string
>;

export type RabbitSourceMessageBusOptions<M extends IRabbitMessage> = {
  logger?: ILogger;
  nackTimeout?: number;
  validate?: ValidateMessageFn<M>;
};

export type RabbitSourceOptions = {
  config?: Options.Connect;
  connectInterval?: number;
  connectTimeout?: number;
  deadletters?: string;
  exchange?: string;
  logger: ILogger;
  messages: RabbitSourceMessages;
  nackTimeout?: number;
  url: string;
};
