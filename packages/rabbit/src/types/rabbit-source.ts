import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Options } from "amqplib";
import { IRabbitMessage } from "../interfaces";
import { CreateRabbitMessageFn, ValidateRabbitMessageFn } from "./rabbit-message-bus";

export type RabbitSourceMessage<M extends IRabbitMessage = IRabbitMessage> = {
  Message: Constructor<M>;
  create?: CreateRabbitMessageFn<M>;
  validate?: ValidateRabbitMessageFn<M>;
};

export type RabbitSourceMessages = Array<
  Constructor<IRabbitMessage> | RabbitSourceMessage | string
>;

export type RabbitSourceMessageBusOptions<M extends IRabbitMessage> = {
  logger?: ILogger;
  nackTimeout?: number;
  create?: CreateRabbitMessageFn<M>;
  validate?: ValidateRabbitMessageFn<M>;
};

export type CloneRabbitSourceOptions = {
  logger?: ILogger;
};

export type RabbitSourceOptions = {
  config?: Options.Connect;
  connectInterval?: number;
  connectTimeout?: number;
  deadletters?: string;
  exchange?: string;
  logger: ILogger;
  messages?: RabbitSourceMessages;
  nackTimeout?: number;
  url: string;
};
