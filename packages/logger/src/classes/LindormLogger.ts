import { isArray, isError, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { get, set } from "object-path";
import winston, { Logger as WinstonLogger } from "winston";
import { LogLevel } from "../enums";
import {
  FilterRecord,
  ILogger,
  LindormLoggerOptions,
  LogContext,
  LogDetails,
  LogSession,
} from "../types";
import { _FromLogger, _Log } from "../types/private";
import { _defaultFilterCallback, _readableFormat } from "../utils/private";

export class LindormLogger implements ILogger {
  private readonly _filters: FilterRecord;
  private readonly _winston: WinstonLogger;

  private _context: LogContext;
  private _session: LogSession;

  public constructor(options?: LindormLoggerOptions);
  public constructor(fromLogger: _FromLogger);
  public constructor(options: LindormLoggerOptions | _FromLogger = {}) {
    if ("_mode" in options && options._mode === "from_logger") {
      this._context = options.context;
      this._filters = options.filters;
      this._session = options.session;
      this._winston = options.winston;
    } else {
      this._context = [];
      this._filters = {};
      this._session = {};
      this._winston = winston.createLogger();

      const level = (options as LindormLoggerOptions).level ?? LogLevel.Info;
      const readable = (options as LindormLoggerOptions).readable ?? false;

      this._winston.add(
        new winston.transports.Console({
          handleExceptions: true,
          level,
          format: readable
            ? winston.format.printf((log) => _readableFormat(log as _Log))
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

    return this._fromLogger(context, session);
  }

  public context(context: LogContext | string): void {
    this._context = this._context.concat(isArray(context) ? context : [context]);
  }

  public filter(path: string, callback?: (value: any) => any): void {
    this._filters[path] = callback ?? _defaultFilterCallback;
  }

  public session(session: LogSession): void {
    this._session = { ...this._session, ...session };
  }

  // logging

  public error(error: Error): void;
  public error(message: string, ...details: Array<Error | Dict>): void;
  public error(arg1: Error | string, ...details: Array<Error | Dict>): void {
    const isErr = isError(arg1);

    this._log({
      details: isErr ? [arg1] : details?.length ? details : [],
      level: LogLevel.Error,
      message: isErr ? arg1.message : arg1,
    });
  }

  public warn(message: string, ...details: Array<Dict>): void {
    this._log({ details, level: LogLevel.Warn, message });
  }

  public info(message: string, ...details: Array<Dict>): void {
    this._log({ details, level: LogLevel.Info, message });
  }

  public verbose(message: string, ...details: Array<Dict>): void {
    this._log({ details, level: LogLevel.Verbose, message });
  }

  public debug(message: string, ...details: Array<Dict>): void {
    this._log({ details, level: LogLevel.Debug, message });
  }

  public silly(message: string, ...details: Array<Dict>): void {
    this._log({ details, level: LogLevel.Silly, message });
  }

  // private

  private _getFilteredDetails(details: LogDetails): LogDetails {
    if (!isObject(details)) return details ?? undefined;
    if (!Object.keys(this._filters).length) return details;
    if (isError((details as any)?.error) && isArray((details as any)?.stack))
      return details;

    try {
      const data = structuredClone(details);

      for (const [path, callback] of Object.entries(this._filters)) {
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

  private _extractErrorData(details: LogDetails): LogDetails {
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

  private _log(log: Omit<_Log, "context" | "session" | "time">): void {
    this._winston.log({
      context: this._context,
      details: log.details
        .filter((d) => d)
        .map((d) => this._extractErrorData(d))
        .map((d) => this._getFilteredDetails(d)),
      level: log.level,
      message: log.message,
      session: this._session,
      time: new Date(),
    });
  }

  private _fromLogger(context: Array<string>, session: Dict): ILogger {
    return new LindormLogger({
      _mode: "from_logger",
      context: structuredClone(this._context.concat(context)),
      filters: structuredClone(this._filters),
      session: { ...structuredClone(this._session), ...session },
      winston: this._winston,
    });
  }
}
