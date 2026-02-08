import { Dict } from "@lindorm/types";
import { LogLevel } from "../../types";
import { LogContent, LogCorrelation } from "../types";

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
