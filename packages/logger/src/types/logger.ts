import { Dict } from "@lindorm/types";
import { FilterCallback, LogContext, LogSession } from "./types";

export interface Logger {
  child(): Logger;
  child(context: LogContext): Logger;
  child(session: LogSession): Logger;
  child(context: LogContext, session: LogSession): Logger;

  context(context: LogContext): void;
  filter(path: string, callback?: FilterCallback): void;
  session(session: LogSession): void;

  error(error: Error): void;
  error(message: string, details?: Error | Dict): void;

  warn(message: string, details?: Dict): void;
  info(message: string, details?: Dict): void;
  verbose(message: string, details?: Dict): void;
  debug(message: string, details?: Dict): void;
  silly(message: string, details?: Dict): void;
}
