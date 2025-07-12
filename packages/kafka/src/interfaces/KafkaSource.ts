import { IMessage, MessageScannerInput } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka } from "kafkajs";
import { CloneKafkaSourceOptions, KafkaSourceMessageBusOptions } from "../types";
import { IKafkaMessageBus } from "./KafkaMessageBus";

export interface IKafkaSource {
  name: "KafkaSource";

  client: Kafka;

  clone(options?: CloneKafkaSourceOptions): IKafkaSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addMessages(messages: MessageScannerInput): void;
  messageBus<M extends IMessage>(
    target: Constructor<M>,
    options?: KafkaSourceMessageBusOptions,
  ): IKafkaMessageBus<M>;
}
