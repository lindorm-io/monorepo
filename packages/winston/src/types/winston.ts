import { LogLevel } from "../enum";
import { Logger } from "../class";
import { TransformableInfo } from "logform";

export type FilterCallback = (data: any) => string;
export type FilterRecord = Record<string, FilterCallback>;
export type LogDetails = Record<string, any> | Error | null;
export type SessionMetadata = Record<string, string | number | boolean>;

export interface LoggerMessage extends TransformableInfo {
  context: Array<string>;
  details: LogDetails;
  level: LogLevel;
  message: string;
  session: SessionMetadata;
}

export interface LoggerOptions {
  context?: Array<string>;
  filters?: FilterRecord;
  parent?: Logger;
  session?: SessionMetadata;
}

export interface LoggerTransportOptions {
  readable: boolean;
  colours: boolean;
  timestamp: boolean;
}
