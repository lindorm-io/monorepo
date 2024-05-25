import { Dict } from "@lindorm/types";
import { FilterCallback, LogContext, LogSession } from "./types";

export interface ILogger {
  child(): ILogger;
  child(context: LogContext): ILogger;
  child(session: LogSession): ILogger;
  child(context: LogContext, session: LogSession): ILogger;

  filter(path: string, callback?: FilterCallback): void;

  error(error: Error): void;
  error(message: string, details?: Error | Dict): void;

  warn(message: string, details?: Dict): void;
  info(message: string, details?: Dict): void;
  verbose(message: string, details?: Dict): void;
  debug(message: string, details?: Dict): void;
  silly(message: string, details?: Dict): void;
}
