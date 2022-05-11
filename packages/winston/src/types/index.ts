import { LogLevel } from "../enum";
import { Logger } from "../class";
import { TransformableInfo } from "logform";

export type ChildLoggerContext = Array<string> | string;
export type LogDetails = Record<string, any> | Error | null;
export type SessionMetadata = Record<string, string | number | boolean>;
export type FilterCallback = (data: any) => string;

export interface LoggerMessage extends TransformableInfo {
  context: Array<string>;
  details: LogDetails;
  level: LogLevel;
  message: string;
  session: Record<string, any>;
}

export interface Filter {
  path: string;
  callback?: FilterCallback;
}

export interface WinstonInstanceOptions {
  filter?: Array<Filter>;
}

export interface LoggerOptions extends WinstonInstanceOptions {
  context?: ChildLoggerContext;
  parent?: Logger;
  session?: Record<string, any>;
}
