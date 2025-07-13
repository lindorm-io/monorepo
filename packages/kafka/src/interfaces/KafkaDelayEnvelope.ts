export type IKafkaDelayEnvelope = {
  id: string;
  key?: string;
  topic: string;
  value: Buffer;
  timestamp: number;
};
