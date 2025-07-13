import { KafkaDelayOptions, KafkaDelayPollCallback } from "../types";

export interface IKafkaDelayService {
  delay(envelope: KafkaDelayOptions): Promise<void>;
  poll(topic: string, callback: KafkaDelayPollCallback): void;

  disconnect(): Promise<void>;
  stop(topic: string): Promise<void>;
}
