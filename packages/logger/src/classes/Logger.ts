import { camelKeys, snakeArray } from "@lindorm/case";
import { isArray, isError, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { get, set } from "object-path";
import winston, { Logger as WinstonLogger } from "winston";
import { LogLevel } from "../enums";
import {
  FilterRecord,
  ILogger,
  LogContext,
  LogDetails,
  LogSession,
  LoggerOptions,
} from "../types";
import { FromLogger, Log } from "../types/private";
import { defaultFilterCallback, readableFormat } from "../utils/private";

export class Logger implements ILogger {
  private readonly filters: FilterRecord;
  private readonly winston: WinstonLogger;

  private context: LogContext;
  private session: LogSession;

  public constructor(options?: LoggerOptions);
  public constructor(fromLogger: FromLogger);
  public constructor(options: LoggerOptions | FromLogger = {}) {
    if ("_mode" in options && options._mode === "from_logger") {
      this.context = snakeArray(options.context);
      this.filters = options.filters;
      this.session = camelKeys(options.session);
      this.winston = options.winston;
    } else {
      this.context = [];
      this.filters = {};
      this.session = {};
      this.winston = winston.createLogger();

      const level = (options as LoggerOptions).level ?? LogLevel.Info;
      const readable = (options as LoggerOptions).readable ?? false;

      this.winston.add(
        new winston.transports.Console({
          handleExceptions: true,
          level,
          format: readable
            ? winston.format.printf((log) => readableFormat(log as Log))
            : winston.format.json(),
        }),
      );
    }
  }

  // utility

  public child(): ILogger;
  public child(context: LogContext): ILogger;
  public child(session: LogSession): ILogger;
  public child(arg1?: LogContext | LogSession, arg2?: LogSession): ILogger {
    const context = isArray(arg1) ? arg1 : [];
    const session = isObject(arg1) ? arg1 : isObject(arg2) ? arg2 : {};

    return this.fromLogger(context, session);
  }

  public filter(path: string, callback?: (value: any) => any): void {
    this.filters[path] = callback ?? defaultFilterCallback;
  }

  // logging

  public error(error: Error): void;
  public error(message: string, ...details: Array<Error | Dict>): void;
  public error(arg1: Error | string, ...details: Array<Error | Dict>): void {
    const isErr = isError(arg1);

    this.log({
      details: isErr ? [arg1] : details?.length ? details : [],
      level: LogLevel.Error,
      message: isErr ? arg1.message : arg1,
    });
  }

  public warn(message: string, ...details: Array<Dict>): void {
    this.log({ details, level: LogLevel.Warn, message });
  }

  public info(message: string, ...details: Array<Dict>): void {
    this.log({ details, level: LogLevel.Info, message });
  }

  public verbose(message: string, ...details: Array<Dict>): void {
    this.log({ details, level: LogLevel.Verbose, message });
  }

  public debug(message: string, ...details: Array<Dict>): void {
    this.log({ details, level: LogLevel.Debug, message });
  }

  public silly(message: string, ...details: Array<Dict>): void {
    this.log({ details, level: LogLevel.Silly, message });
  }

  // private

  private getFilteredDetails(details: LogDetails): LogDetails {
    if (!isObject(details)) return details ?? undefined;
    if (!Object.keys(this.filters).length) return details;
    if (isError((details as any)?.error) && isArray((details as any)?.stack))
      return details;

    try {
      const data = structuredClone(details);

      for (const [path, callback] of Object.entries(this.filters)) {
        if (!callback) continue;

        const item = get(details, path);
        if (!item) continue;

        set(data, path, callback(item));
      }

      return data;
    } catch (err) {
      return details;
    }
  }

  private extractErrorData(details: LogDetails): LogDetails {
    if (!isError(details)) return details;

    return {
      error: details,
      name: details.name,
      message: details.message,
      stack: details.stack
        ? details.stack
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s)
        : [],
    };
  }

  // private

  private log(log: Omit<Log, "context" | "session" | "time">): void {
    this.winston.log({
      context: this.context,
      details: log.details
        .filter((d) => d)
        .map((d) => this.extractErrorData(d))
        .map((d) => this.getFilteredDetails(d)),
      level: log.level,
      message: log.message,
      session: this.session,
      time: new Date(),
    });
  }

  private fromLogger(context: Array<string>, session: Dict): ILogger {
    return new Logger({
      _mode: "from_logger",
      context: structuredClone(this.context.concat(context)),
      filters: structuredClone(this.filters),
      session: { ...structuredClone(this.session), ...session },
      winston: this.winston,
    });
  }
}
