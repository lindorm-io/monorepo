import type { ILogger } from "@lindorm/logger";
import type { IDeadLetterStore } from "../../interfaces/IrisDeadLetterStore.js";

export type DeadLetterManagerSettings = {
  store: IDeadLetterStore;
  logger: ILogger;
};
