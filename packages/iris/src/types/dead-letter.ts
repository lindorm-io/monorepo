import type { IrisEnvelope } from "./envelope.js";

export type DeadLetterEntry = {
  id: string;
  envelope: IrisEnvelope;
  topic: string;
  error: string;
  errorStack: string | null;
  attempt: number;
  timestamp: number;
};

export type DeadLetterListOptions = {
  topic?: string;
  limit?: number;
  offset?: number;
};

export type DeadLetterFilterOptions = {
  topic?: string;
};
