export type IrisEnvelope = {
  topic: string;
  payload: Buffer;
  headers: Record<string, string>;
  priority: number;
  timestamp: number;
  expiry: number | null;
  broadcast: boolean;
  attempt: number;
  maxRetries: number;
  retryStrategy: "constant" | "linear" | "exponential";
  retryDelay: number;
  retryDelayMax: number;
  retryMultiplier: number;
  retryJitter: boolean;
  replyTo: string | null;
  correlationId: string | null;
  identifierValue: string | null;
};
