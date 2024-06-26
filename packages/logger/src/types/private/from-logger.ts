import { Logger as WinstonLogger } from "winston";
import { FilterRecord, LogContext, LogSession } from "../types";

export type _FromLogger = {
  _mode: "from_logger";
  context: LogContext;
  filters: FilterRecord;
  session: LogSession;
  winston: WinstonLogger;
};
