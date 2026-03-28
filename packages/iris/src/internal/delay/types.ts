import type { ILogger } from "@lindorm/logger";
import type { IDelayStore } from "../../interfaces/IrisDelayStore";

export type DelayManagerOptions = {
  store: IDelayStore;
  logger: ILogger;
  pollIntervalMs?: number;
};
