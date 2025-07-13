import { KafkaDelayOptions } from "../types";
import { IKafkaDelayEnvelope } from "./KafkaDelayEnvelope";

export interface IKafkaDelayStore {
  get(topic: string): Promise<Array<IKafkaDelayEnvelope>>;
  add(envelope: KafkaDelayOptions): Promise<void>;
  ack(id: string): Promise<void>;
}
