import type { ILogger } from "@lindorm/logger";
import type { IDelayStore } from "../../interfaces/IrisDelayStore.js";

export type DelayManagerSettings = {
  store: IDelayStore;
  logger: ILogger;
  pollIntervalMs?: number;
};
