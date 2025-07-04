import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ChannelModel } from "amqplib";
import {
  CloneRabbitSourceOptions,
  MessageScannerInput,
  RabbitSourceMessageBusOptions,
} from "../types";
import { IRabbitMessageBus } from "./RabbitMessageBus";

export interface IRabbitSource {
  name: "RabbitSource";

  client: ChannelModel;

  clone(options?: CloneRabbitSourceOptions): IRabbitSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addMessages(messages: MessageScannerInput): void;
  messageBus<M extends IMessage>(
    Message: Constructor<M>,
    options?: RabbitSourceMessageBusOptions,
  ): IRabbitMessageBus<M>;
}
