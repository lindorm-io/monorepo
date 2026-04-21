import type { Dict } from "@lindorm/types";
import type { LogContent, LogCorrelation, LogLevel } from "../../types/index.js";

export type InternalLog = {
  context: Dict | Error;
  correlation: LogCorrelation;
  duration?: number;
  extra: Array<LogContent>;
  level: LogLevel;
  message: string;
  scope: Array<string>;
  time: Date;
};
