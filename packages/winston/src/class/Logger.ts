import * as winston from "winston";
import { LogLevel } from "../enum";
import { LoggerError } from "../error";
import { cloneDeep, flatten, get, isArray, isError, isObject, merge, set } from "lodash";
import { defaultFilterCallback, readableFormat } from "../util";
import { snakeArray } from "@lindorm-io/core";
import {
  FileTransportOptions,
  HttpTransportOptions,
  StreamTransportOptions,
} from "winston/lib/winston/transports";
import {
  FilterCallback,
  FilterRecord,
  ILogger,
  LogDetails,
  LoggerMessage,
  LoggerOptions,
  LoggerTransportOptions,
  SessionMetadata,
} from "../types";

export class Logger implements ILogger {
  private readonly winston: winston.Logger;

  public readonly className: string;

  private context: Array<string>;
  private filters: FilterRecord;
  private session: Record<string, any> | undefined;

  public constructor(options: LoggerOptions = {}) {
    const { context = [], filters = {}, parent, session = {} } = options;

    this.context = parent ? flatten([parent.context, snakeArray(context)]) : snakeArray(context);
    this.filters = parent ? { ...parent.filters, ...filters } : filters;
    this.session = parent ? merge(cloneDeep(parent.session), session) : session;
    this.winston = parent ? parent.winston : winston.createLogger();

    this.className = this.constructor.name;
  }

  // public

  public error(message: string, details?: LogDetails): void {
    this.log({
      level: LogLevel.ERROR,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public warn(message: string, details?: LogDetails): void {
    this.log({
      level: LogLevel.WARN,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public info(message: string, details?: LogDetails): void {
    this.log({
      level: LogLevel.INFO,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public verbose(message: string, details?: LogDetails): void {
    this.log({
      level: LogLevel.VERBOSE,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public debug(message: string, details?: LogDetails): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public silly(message: string, details?: LogDetails): void {
    this.log({
      level: LogLevel.SILLY,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public createChildLogger(context: Array<string>): Logger {
    if (!isArray(context)) {
      throw new LoggerError("Invalid logger context");
    }
    return new Logger({ context, parent: this });
  }

  public createSessionLogger(session: SessionMetadata): Logger {
    if (!isObject(session)) {
      throw new LoggerError("Invalid logger session");
    }
    return new Logger({ session, parent: this });
  }

  public setFilter(path: string, callback?: FilterCallback): void {
    this.filters[path] = callback || defaultFilterCallback;
  }

  public deleteFilter(path: string): void {
    this.filters[path] = undefined;
  }

  public clearFilters(): void {
    this.filters = {};
  }

  public addConsole(
    level: LogLevel = LogLevel.DEBUG,
    options: Partial<LoggerTransportOptions> = {},
  ): void {
    this.winston.add(
      new winston.transports.Console({
        handleExceptions: true,
        level,
        format: options.readable
          ? winston.format.printf((info) => readableFormat(info as LoggerMessage, options))
          : winston.format.json(),
      }),
    );
  }

  public addFileTransport(level: LogLevel = LogLevel.DEBUG, options?: FileTransportOptions): void {
    this.winston.add(
      new winston.transports.File({
        handleExceptions: true,
        maxsize: options?.maxsize || 5242880,
        maxFiles: options?.maxFiles || 10,
        ...options,
        level,
      }),
    );
  }

  public addHttpTransport(level: LogLevel, options: HttpTransportOptions): void {
    this.winston.add(
      new winston.transports.Http({
        handleExceptions: true,
        ...options,
        level,
      }),
    );
  }

  public addStreamTransport(level: LogLevel, options: StreamTransportOptions): void {
    this.winston.add(
      new winston.transports.Stream({
        handleExceptions: true,
        ...options,
        level,
      }),
    );
  }

  public addTransport(transport: any): void {
    this.winston.add(transport);
  }

  public addContext(context: Array<string>): void {
    if (!isArray(context)) {
      throw new Error("Invalid context");
    }
    this.context = flatten([this.context, snakeArray(context)]);
  }

  public addSession(session: Record<string, any>): void {
    if (!isObject(session)) {
      throw new Error("Invalid session");
    }
    this.session = merge(cloneDeep(this.session), session);
  }

  public isError(): boolean {
    return true;
  }

  public isWarn(): boolean {
    return true;
  }

  public isInfo(): boolean {
    return true;
  }

  public isDebug(): boolean {
    return true;
  }

  // private

  private getFilteredDetails(details: LogDetails): LogDetails {
    if (!isObject(details)) return details;
    if (isError(details)) return details;

    const data = cloneDeep(details);

    for (const [path, callback] of Object.entries(this.filters)) {
      if (!callback) continue;

      const item = get(data, path);
      if (!item) continue;

      set(data, path, callback(item));
    }

    return data;
  }

  private log(options: LoggerMessage): void {
    this.winston.log({
      context: options.context,
      details: this.getFilteredDetails(options.details),
      level: options.level,
      message: options.message,
      session: options.session,
      time: new Date(),
    });
  }
}
