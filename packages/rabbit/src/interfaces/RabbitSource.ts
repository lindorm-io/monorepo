import { Constructor } from "@lindorm/types";
import { ChannelModel } from "amqplib";
import {
  CloneRabbitSourceOptions,
  RabbitSourceMessageBusOptions,
  RabbitSourceMessages,
} from "../types";
import { IRabbitMessage } from "./RabbitMessage";
import { IRabbitMessageBus } from "./RabbitMessageBus";

export interface IRabbitSource {
  client: ChannelModel;

  addMessages(messages: RabbitSourceMessages): void;
  clone(options?: CloneRabbitSourceOptions): IRabbitSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  messageBus<M extends IRabbitMessage>(
    Message: Constructor<M>,
    options?: RabbitSourceMessageBusOptions<M>,
  ): IRabbitMessageBus<M>;
}
