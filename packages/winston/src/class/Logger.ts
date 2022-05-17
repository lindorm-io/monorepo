import { LogLevel } from "../enum";
import { WinstonError } from "../error";
import { WinstonInstance } from "./WinstonInstance";
import { cloneDeep, get, isArray, isError, isObject, isString, set } from "lodash";
import { defaultFilterCallback } from "../util";
import {
  HttpTransportOptions,
  StreamTransportOptions,
  FileTransportOptions,
} from "winston/lib/winston/transports";
import {
  LoggerOptions,
  ChildLoggerContext,
  FilterCallback,
  LogDetails,
  SessionMetadata,
  LoggerTransportOptions,
  Filter,
  LoggerMessage,
} from "../types";

export class Logger {
  private readonly context: Array<string>;
  private readonly filters: Array<Filter>;
  private readonly winston: WinstonInstance;
  private session: Record<string, any> | undefined;

  public constructor(options: LoggerOptions = {}) {
    this.filters = options.filters || [];

    if (options.parent) {
      this.context = cloneDeep(options.parent.context);
      this.winston = options.parent.winston;
    } else {
      this.context = [];
      this.winston = new WinstonInstance();
    }

    if (options.session) {
      this.session = options.session;
    } else if (options.parent) {
      this.session = cloneDeep(options.parent.session);
    }

    this.addContext(options.context || []);
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

  public createChildLogger(context: ChildLoggerContext): Logger {
    if (!isString(context) && !isArray(context)) {
      throw new WinstonError("Invalid logger context");
    }

    return new Logger({ context, parent: this });
  }

  public createSessionLogger(session: Record<string, any>): Logger {
    if (!isObject(session)) {
      throw new WinstonError("Invalid logger session");
    }

    if (this.session) {
      throw new WinstonError("Logger session already exists");
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

  public setFocus(focus: string | null): void {
    this.winston.setFocus(focus);
  }

  public addConsole(
    level: LogLevel = LogLevel.DEBUG,
    options: Partial<LoggerTransportOptions> = {},
  ): void {
    this.winston.addConsole(level, options);
  }

  public addFileTransport(level: LogLevel = LogLevel.DEBUG, options?: FileTransportOptions): void {
    this.winston.addFileTransport(level, options);
  }

  public addHttpTransport(level: LogLevel, options: HttpTransportOptions): void {
    this.winston.addHttpTransport(level, options);
  }

  public addStreamTransport(level: LogLevel, options: StreamTransportOptions): void {
    this.winston.addStreamTransport(level, options);
  }

  public addTransport(transport: any): void {
    this.winston.addTransport(transport);
  }

  // private

  private addContext(context: ChildLoggerContext): void {
    if (isArray(context)) {
      for (const item of context) {
        this.context.push(item);
      }
    } else if (isString(context)) {
      this.context.push(context);
    }
  }

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
    const { details, ...data } = options;

    this.winston.log({
      details: this.getFilteredDetails(details),
      ...data,
    });
  }
}
