import type { IrisEnvelope } from "./envelope.js";

export type DelayedEntry = {
  id: string;
  envelope: IrisEnvelope;
  topic: string;
  deliverAt: number;
  /**
   * Fully-resolved destination the entry must be delivered to, bypassing the
   * driver's usual topic/broadcast resolution. Set by the Kafka targeted-retry
   * path (M1) so a delayed retry goes to the failing group's per-group retry
   * topic instead of fanning back out across the shared topic. Absent for a
   * normal delayed publish, which resolves its destination from `topic`.
   */
  destinationTopic?: string;
};
