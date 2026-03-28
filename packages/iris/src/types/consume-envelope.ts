export type ConsumeEnvelope = {
  topic: string;
  messageName: string;
  namespace: string | null;
  version: number;
  headers: Record<string, string>;
  attempt: number;
  correlationId: string | null;
  timestamp: number;
};
