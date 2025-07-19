import { IMessage, MessageScannerInput } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka } from "kafkajs";
import { WithLoggerOptions } from "../types";
import { IKafkaMessageBus } from "./KafkaMessageBus";
import { IKafkaPublisher } from "./KafkaPublisher";

export interface IKafkaSource {
  name: "KafkaSource";

  client: Kafka;

  clone(options?: WithLoggerOptions): IKafkaSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addMessages(messages: MessageScannerInput): void;
  hasMessage(target: Constructor<IMessage>): boolean;

  messageBus<M extends IMessage>(
    target: Constructor<M>,
    options?: WithLoggerOptions,
  ): IKafkaMessageBus<M>;

  publisher<M extends IMessage>(
    target: Constructor<M>,
    options?: WithLoggerOptions,
  ): IKafkaPublisher<M>;
}
