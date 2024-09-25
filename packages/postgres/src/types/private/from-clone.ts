import { ILogger } from "@lindorm/logger";
import { Pool } from "pg";

export type FromClone = {
  _mode: "from_clone";
  client: Pool;
  logger: ILogger;
};
