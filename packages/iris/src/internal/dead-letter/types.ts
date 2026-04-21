import type { ILogger } from "@lindorm/logger";
import type { IDeadLetterStore } from "../../interfaces/IrisDeadLetterStore.js";

export type DeadLetterManagerOptions = {
  store: IDeadLetterStore;
  logger: ILogger;
};
