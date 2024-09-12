import { Dict } from "@lindorm/types";
import { LogLevel } from "../../enums";
import { LogContent, LogCorrelation } from "../types";

export type InternalLog = {
  context: Dict | Error;
  correlation: LogCorrelation;
  extra: Array<LogContent>;
  level: LogLevel;
  message: string;
  scope: Array<string>;
  time: Date;
};
