import type { IrisEnvelope } from "./envelope";

export type DelayedEntry = {
  id: string;
  envelope: IrisEnvelope;
  topic: string;
  deliverAt: number;
};
