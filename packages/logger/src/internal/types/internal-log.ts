import { Dict } from "@lindorm/types";
import { LogContent, LogCorrelation, LogLevel } from "../../types";

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
