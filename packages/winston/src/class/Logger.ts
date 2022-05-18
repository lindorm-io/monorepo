import * as winston from "winston";
import { LogLevel } from "../enum";
import { WinstonError } from "../error";
import { cloneDeep, get, isError, isObject, merge, set } from "lodash";
import { defaultFilterCallback, readableFormat } from "../util";
import {
  FileTransportOptions,
  HttpTransportOptions,
  StreamTransportOptions,
} from "winston/lib/winston/transports";
import {
  Filter,
  FilterCallback,
  LogDetails,
  LoggerMessage,
  LoggerOptions,
  LoggerTransportOptions,
  SessionMetadata,
} from "../types";

export class Logger {
  private readonly filters: Array<Filter>;
  private readonly winston: winston.Logger;

  private context: Record<string, string>;
  private session: Record<string, any> | undefined;

  public constructor(options: LoggerOptions = {}) {
    this.filters = options.filters || [];

    if (options.parent) {
      this.context = merge(cloneDeep(options.parent.context), options.context || {});
      this.winston = options.parent.winston;
    } else {
      this.context = options.context || {};
      this.winston = winston.createLogger();
    }

    if (options.session) {
      this.session = options.session;
    } else if (options.parent) {
      this.session = merge(cloneDeep(options.parent.session), options.session || {});
    }
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

  public createChildLogger(context: Record<string, string>): Logger {
    if (!isObject(context)) {
      throw new WinstonError("Invalid logger context");
    }

    return new Logger({ context, parent: this });
  }

  public createSessionLogger(session: Record<string, any>): Logger {
    if (!isObject(session)) {
      throw new WinstonError("Invalid logger session");
    }

    return new Logger({ session, parent: this });
  }

  public addSessionMetadata(metadata: SessionMetadata): void {
    if (!this.session) {
      throw new WinstonError("Logger session not found");
    }

    this.session = {
      ...this.session,
      metadata,
    };
  }

  public addFilter(path: string, callback?: FilterCallback): void {
    this.filters.push({ path, callback });
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

  public addContext(context: Record<string, string>): void {
    if (!isObject(context)) {
      throw new Error("Invalid context");
    }
    this.context = merge(cloneDeep(this.context), context);
  }

  public addSession(session: Record<string, any>): void {
    if (!isObject(session)) {
      throw new Error("Invalid session");
    }
    this.session = merge(cloneDeep(this.session), session);
  }

  // private

  private getFilteredDetails(details: LogDetails): LogDetails {
    if (!isObject(details)) return details;
    if (isError(details)) return details;

    const data = cloneDeep(details);

    for (const filter of this.filters) {
      const item = get(data, filter.path);

      if (!item) continue;

      const callback = filter.callback || defaultFilterCallback;

      set(data, filter.path, callback(item));
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
