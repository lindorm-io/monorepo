import { camelCase, camelKeys } from "@lindorm/case";
import { isArray, isError, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import fastSafeStringify from "fast-safe-stringify";
import objectPath from "object-path";
import { Logger as WinstonLogger } from "winston";
import type { ILogger, ILoggerTimer } from "../interfaces/index.js";
import type {
  FilterCallback,
  Log,
  LogContent,
  LogCorrelation,
  LogFilters,
  LogLevel,
  LogScope,
} from "../types/index.js";
import type {
  FilterEntriesRef,
  KeyFilterRef,
  LoggerBaseOptions,
} from "../internal/types/logger-base-options.js";
import type { InternalLog } from "../internal/types/internal-log.js";
import { LoggerTimer } from "./LoggerTimer.js";

// Shared logger behaviour used by both Logger (root) and LoggerChild.
// Concrete subclasses own construction: Logger creates winston/transport
// and registers process handlers, LoggerChild inherits refs from a parent.
// Spawning children is delegated via the abstract `spawnChild` hook so
// LoggerBase doesn't need to import LoggerChild directly.
export abstract class LoggerBase implements ILogger {
  public readonly __instanceof = "Logger";

  protected readonly filters: LogFilters;
  protected readonly filterRef: FilterEntriesRef;
  protected readonly keyFilterRef: KeyFilterRef;
  protected readonly timers: Map<string, number>;
  protected readonly winston: WinstonLogger;
  protected _correlation: LogCorrelation;
  protected _scope: LogScope;

  protected constructor(options: LoggerBaseOptions) {
    this._correlation = options.correlation;
    this._scope = options.scope;
    this.filters = options.filters;
    this.filterRef = options.filterRef;
    this.keyFilterRef = options.keyFilterRef;
    this.timers = options.timers;
    this.winston = options.winston;
  }

  // child spawning — concrete subclasses decide what class to instantiate

  protected abstract spawnChild(options: LoggerBaseOptions): ILogger;

  // level

  public get level(): LogLevel {
    return this.winston.level as LogLevel;
  }

  // utility

  public child(): ILogger;
  public child(scope: LogScope): ILogger;
  public child(correlation: LogCorrelation): ILogger;
  public child(scope: LogScope, correlation: LogCorrelation): ILogger;
  public child(arg1?: LogScope | LogCorrelation, arg2?: LogCorrelation): ILogger {
    const scope = isArray(arg1) ? arg1 : [];
    const correlation = isObject(arg1) ? arg1 : isObject(arg2) ? arg2 : {};

    return this.spawnChild({
      correlation: this.getCorrelation(correlation as LogCorrelation),
      filters: this.filters,
      filterRef: this.filterRef,
      keyFilterRef: this.keyFilterRef,
      scope: this.getScope(scope),
      timers: new Map(this.timers),
      winston: this.winston,
    });
  }

  public correlation(correlation: LogCorrelation): void {
    this._correlation = this.getCorrelation(correlation);
  }

  public isLevelEnabled(level: LogLevel): boolean {
    return this.winston.isLevelEnabled(level);
  }

  public scope(scope: LogScope): void {
    this._scope = this.getScope(scope);
  }

  public time(): ILoggerTimer;
  public time(label: string): void;
  public time(label?: string): ILoggerTimer | void {
    if (label !== undefined) {
      this.timers.set(label, performance.now());
      return;
    }
    return new LoggerTimer((level, message, context, extra, duration) => {
      this.logToWinston({ context: context ?? {}, duration, extra, level, message });
    });
  }

  public timeEnd(label: string, context?: LogContent, extra?: Array<LogContent>): void;
  public timeEnd(
    label: string,
    level: LogLevel,
    context?: LogContent,
    extra?: Array<LogContent>,
  ): void;
  public timeEnd(
    label: string,
    levelOrContext?: LogLevel | LogContent,
    contextOrExtra?: LogContent | Array<LogContent>,
    extra?: Array<LogContent>,
  ): void {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.warn(`Timer "${label}" does not exist`);
      return;
    }
    this.timers.delete(label);

    const isLevel = typeof levelOrContext === "string";
    const level: LogLevel = isLevel ? levelOrContext : "debug";
    const context: LogContent = isLevel
      ? (contextOrExtra as LogContent)
      : (levelOrContext as LogContent);
    const extraArr = isLevel
      ? (extra ?? [])
      : isArray<LogContent>(contextOrExtra)
        ? contextOrExtra
        : [];

    this.logToWinston({
      context: context ?? {},
      duration: performance.now() - start,
      extra: extraArr,
      level,
      message: label,
    });
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

    const hasPathFilters = this.filterRef.entries.length > 0;
    const hasKeyFilters =
      this.keyFilterRef.exact.size > 0 || this.keyFilterRef.patterns.length > 0;

    if (!hasPathFilters && !hasKeyFilters) return content;
    if (isError((content as any)?.error) && isArray((content as any)?.stack))
      return content;

    const pathMatches: Array<[string, FilterCallback, any]> = [];
    if (hasPathFilters) {
      for (const [path, callback] of this.filterRef.entries) {
        if (!callback) continue;
        const item = objectPath.get(content, path);
        if (!item) continue;
        pathMatches.push([path, callback, item]);
      }
    }

    const keyMatches: Array<[string, FilterCallback, any]> = [];
    if (hasKeyFilters) {
      this.collectKeyMatches(content as Dict, "", keyMatches);
    }

    if (!pathMatches.length && !keyMatches.length) return content;

    try {
      const data = JSON.parse(fastSafeStringify(content));

      for (const [path, callback, item] of pathMatches) {
        objectPath.set(data, path, callback(item));
      }

      for (const [path, callback, item] of keyMatches) {
        objectPath.set(data, path, callback(item));
      }

      return data;
    } catch {
      return content;
    }
  }

  private collectKeyMatches(
    obj: Dict,
    prefix: string,
    matches: Array<[string, FilterCallback, any]>,
  ): void {
    if (isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const item = obj[i];
        const path = prefix ? `${prefix}.${i}` : `${i}`;
        if (isArray(item) || isObject(item)) {
          this.collectKeyMatches(item as Dict, path, matches);
        }
      }
      return;
    }

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;

      if (value) {
        const exactCb = this.keyFilterRef.exact.get(key);
        if (exactCb) {
          matches.push([path, exactCb, value]);
          continue;
        }

        if (this.keyFilterRef.patterns.length > 0) {
          let matched = false;
          for (const [regex, cb] of this.keyFilterRef.patterns) {
            if (regex.test(key)) {
              matches.push([path, cb, value]);
              matched = true;
              break;
            }
          }
          if (matched) continue;
        }
      }

      if (isArray(value) || isObject(value)) {
        this.collectKeyMatches(value as Dict, path, matches);
      }
    }
  }

  private extractErrorData(content: LogContent): LogContent {
    if (!isError(content)) return content;

    const result: Dict = {
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

    if ((content as any).cause) {
      result.cause = this.extractErrorData((content as any).cause);
    }

    return result;
  }

  private logToWinston(log: Omit<InternalLog, "correlation" | "scope" | "time">): void {
    if (!this.winston.isLevelEnabled(log.level)) return;

    const extra: Array<LogContent> = [];
    for (const item of log.extra) {
      if (!item) continue;
      extra.push(this.getFilteredContent(this.extractErrorData(item)));
    }

    this.winston.log({
      context: log.context
        ? this.getFilteredContent(this.extractErrorData(log.context))
        : {},
      correlation: this._correlation,
      ...(log.duration !== undefined ? { duration: log.duration } : {}),
      extra,
      level: log.level,
      message: log.message,
      scope: this._scope,
      time: new Date(),
    });
  }
}
