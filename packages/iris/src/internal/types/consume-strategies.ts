import type { IrisEnvelope } from "./iris-envelope";

export type ConsumeStrategies = {
  onExpired: () => Promise<void>;
  onDeserializationError: (envelope: IrisEnvelope, error: Error) => Promise<void>;
  retry: (envelope: IrisEnvelope, topic: string, delay: number) => Promise<void>;
  onRetryFailed: (envelope: IrisEnvelope, originalError: Error) => Promise<void>;
  deadLetter: (envelope: IrisEnvelope, topic: string, error: Error) => Promise<void>;
  onExhaustedNoDeadLetter: () => Promise<void>;
  onSuccess: () => Promise<void>;
};
