import { LogLevel } from "../enum";
import { Logger } from "../class";
import { TransformableInfo } from "logform";

export type LogDetails = Record<string, any> | Error | null;
export type SessionMetadata = Record<string, string | number | boolean>;
export type FilterCallback = (data: any) => string;

export interface LoggerMessage extends TransformableInfo {
  context: Array<string>;
  details: LogDetails;
  level: LogLevel;
  message: string;
  session: SessionMetadata;
}

export interface Filter {
  path: string;
  callback?: FilterCallback;
}

export interface LoggerOptions {
  context?: Array<string>;
  filters?: Array<Filter>;
  parent?: Logger;
  session?: SessionMetadata;
}

export interface LoggerTransportOptions {
  readable: boolean;
  colours: boolean;
  timestamp: boolean;
}
