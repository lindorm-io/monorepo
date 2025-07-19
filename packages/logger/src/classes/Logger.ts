import { camelCase, camelKeys } from "@lindorm/case";
import { isArray, isError, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { get, set } from "object-path";
import winston, { Logger as WinstonLogger } from "winston";
import { ILogger } from "../interfaces";
import {
  FilterRecord,
  Log,
  LogContent,
  LogCorrelation,
  LoggerOptions,
  LogScope,
} from "../types";
import { FromLogger, InternalLog } from "../types/private";
import { defaultFilterCallback, readableFormat } from "../utils/private";

export class Logger implements ILogger {
  private readonly filters: FilterRecord;
  private readonly winston: WinstonLogger;
  private _correlation: LogCorrelation;
  private _scope: LogScope;

  public constructor(options?: LoggerOptions);
  public constructor(fromLogger: FromLogger);
  public constructor(options: LoggerOptions | FromLogger = {}) {
    if ("_mode" in options && options._mode === "from_logger") {
      this._correlation = this.getCorrelation(options.correlation);
      this.filters = options.filters;
      this._scope = this.getScope(options.scope);
      this.winston = options.winston;
    } else {
      this._correlation = {};
      this.filters = {};
      this._scope = [];
      this.winston = winston.createLogger();

      const level = (options as LoggerOptions).level ?? "info";
      const readable = (options as LoggerOptions).readable ?? false;

      this.winston.add(
        new winston.transports.Console({
          handleExceptions: true,
          level,
          format: readable
            ? winston.format.printf((log) => readableFormat(log as InternalLog))
            : winston.format.json(),
        }),
      );
    }
  }

  // utility

  public child(): ILogger;
  public child(scope: LogScope): ILogger;
  public child(correlation: LogCorrelation): ILogger;
  public child(arg1?: LogScope | LogCorrelation, arg2?: LogCorrelation): ILogger {
    const scope = isArray(arg1) ? arg1 : [];
    const correlation = isObject(arg1) ? arg1 : isObject(arg2) ? arg2 : {};

    return new Logger({
      _mode: "from_logger",
      correlation: this.getCorrelation(correlation as LogCorrelation),
      filters: { ...this.filters },
      scope: this.getScope(scope),
      winston: this.winston,
    });
  }

  public correlation(correlation: LogCorrelation): void {
    this._correlation = this.getCorrelation(correlation);
  }

  public filter(path: string, callback?: (value: any) => any): void {
    this.filters[path] = callback ?? defaultFilterCallback;
  }

  public scope(scope: LogScope): void {
    this._scope = this.getScope(scope);
  }

  // logging

  public error(error: Error): void;
  public error(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  public error(arg1: Error | string, arg2?: Error | Dict, extra?: Array<Dict>): void {
    const isArg1Error = isError(arg1);
    const isArg2Error = isError(arg2);

    this.logToWinston({
      context: isArg1Error ? arg1 : isArg2Error ? arg2 : {},
      extra: extra ?? [],
      level: "error",
      message: isArg1Error ? arg1.message : arg1,
    });
  }

  public warn(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logToWinston({
      context: context ?? {},
      extra: extra ?? [],
      level: "warn",
      message,
    });
  }

  public info(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logToWinston({
      context: context ?? {},
      extra: extra ?? [],
      level: "info",
      message,
    });
  }

  public verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logToWinston({
      context: context ?? {},
      extra: extra ?? [],
      level: "verbose",
      message,
    });
  }

  public debug(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logToWinston({
      context: context ?? {},
      extra: extra ?? [],
      level: "debug",
      message,
    });
  }

  public silly(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logToWinston({
      context: context ?? {},
      extra: extra ?? [],
      level: "silly",
      message,
    });
  }

  public log(log: Log): void {
    this.logToWinston({
      context: log.context ?? {},
      extra: log.extra ?? [],
      level: log.level ?? "info",
      message: log.message,
    });
  }

  // private

  private getCorrelation(correlation: LogCorrelation = {}): LogCorrelation {
    return { ...(this._correlation ?? {}), ...camelKeys(correlation) };
  }

  private getScope(scope: LogScope = []): LogScope {
    return [
      ...(this._scope ?? []),
      ...scope
        .map((s) => s.trim())
        .filter((s) => s)
        .map((s) => camelCase(s)),
    ];
  }

  private getFilteredContent(content: LogContent): LogContent {
    if (!isObject(content)) return content ?? undefined;
    if (!Object.keys(this.filters).length) return content;
    if (isError((content as any)?.error) && isArray((content as any)?.stack))
      return content;

    try {
      const data = structuredClone(content);

      for (const [path, callback] of Object.entries(this.filters)) {
        if (!callback) continue;

        const item = get(content, path);
        if (!item) continue;

        set(data, path, callback(item));
      }

      return data;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err: any) {
      return content;
    }
  }

  private extractErrorData(content: LogContent): LogContent {
    if (!isError(content)) return content;

    return {
      error: content,
      name: content.name,
      message: content.message,
      stack: content.stack
        ? content.stack
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s)
        : [],
    };
  }

  private logToWinston(log: Omit<InternalLog, "correlation" | "scope" | "time">): void {
    this.winston.log({
      context: log.context
        ? this.getFilteredContent(this.extractErrorData(log.context))
        : {},
      correlation: this._correlation,
      extra: log.extra
        .filter(Boolean)
        .map((d) => this.extractErrorData(d))
        .map((d) => this.getFilteredContent(d)),
      level: log.level,
      message: log.message,
      scope: this._scope,
      time: new Date(),
    });
  }
}
