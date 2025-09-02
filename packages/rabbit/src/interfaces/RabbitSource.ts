import { IMessage, MessageScannerInput } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ChannelModel } from "amqplib";
import { RabbitSourceMessageBusOptions, WithLoggerOptions } from "../types";
import { IRabbitMessageBus } from "./RabbitMessageBus";
import { IRabbitPublisher } from "./RabbitPublisher";

export interface IRabbitSource {
  __instanceof: "RabbitSource";

  client: ChannelModel;

  clone(options?: WithLoggerOptions): IRabbitSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addMessages(messages: MessageScannerInput): void;
  hasMessage(target: Constructor<IMessage>): boolean;

  messageBus<M extends IMessage>(
    target: Constructor<M>,
    options?: RabbitSourceMessageBusOptions,
  ): IRabbitMessageBus<M>;

  publisher<M extends IMessage>(
    target: Constructor<M>,
    options?: WithLoggerOptions,
  ): IRabbitPublisher<M>;
}
