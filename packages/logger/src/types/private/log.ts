import { LogLevel } from "../../enums";
import { LogDetails, LogSession } from "../types";

export type Log = {
  context: Array<string>;
  details: Array<LogDetails>;
  level: LogLevel;
  message: string;
  session: LogSession;
  time: Date;
};
