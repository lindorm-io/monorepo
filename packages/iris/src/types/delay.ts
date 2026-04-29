import type { IrisEnvelope } from "./envelope.js";

export type DelayedEntry = {
  id: string;
  envelope: IrisEnvelope;
  topic: string;
  deliverAt: number;
};
