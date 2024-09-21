import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Options } from "amqplib";
import { IAmqpMessage } from "../interfaces";
import { ValidateMessageFn } from "./amqp-bus";

export type AmqpSourceMessage<M extends IAmqpMessage = IAmqpMessage> = {
  Message: Constructor<M>;
  validate?: ValidateMessageFn<M>;
};

export type AmqpSourceMessages = Array<
  Constructor<IAmqpMessage> | AmqpSourceMessage | string
>;

export type AmqpSourceMessageBusOptions<M extends IAmqpMessage> = {
  logger?: ILogger;
  nackTimeout?: number;
  validate?: ValidateMessageFn<M>;
};

export type AmqpSourceOptions = {
  config?: Options.Connect;
  deadletters?: string;
  exchange?: string;
  logger: ILogger;
  messages: AmqpSourceMessages;
  nackTimeout?: number;
  url: string;
};
