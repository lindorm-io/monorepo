import * as winston from "winston";
import { LogLevel } from "../enum";
import { clone, get, includes, isError, isObject, set } from "lodash";
import { defaultFilterCallback, readableFormat } from "../util";
import {
  Filter,
  LoggerMessage,
  WinstonInstanceOptions,
  FilterCallback,
  LogDetails,
  LoggerTransportOptions,
} from "../types";
import {
  HttpTransportOptions,
  StreamTransportOptions,
  FileTransportOptions,
} from "winston/lib/winston/transports";

export class WinstonInstance {
  private readonly filter: Array<Filter>;
  private readonly winston: winston.Logger;
  private focus: string | null;

  public constructor(options: WinstonInstanceOptions = {}) {
    this.filter = options.filter || [];
    this.focus = null;
    this.winston = winston.createLogger();
  }

  // public

  public log(options: LoggerMessage): void {
    if (this.focus && options.context.length && !includes(options.context, this.focus)) return;

    this.winston.log({
      level: options.level,
      time: new Date(),
      message: options.message,
      details: this.getFilteredDetails(options.details),
      context: options.context,
      session: options.session,
    });
  }

  public addFilter(path: string, callback?: FilterCallback): void {
    this.filter.push({ path, callback });
  }

  public setFocus(focus: string | null): void {
    this.focus = focus || null;
  }

  public addConsole(
    level: LogLevel = LogLevel.DEBUG,
    options: Partial<LoggerTransportOptions>,
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

  public addHttpTransport(level: LogLevel = LogLevel.DEBUG, options: HttpTransportOptions): void {
    this.winston.add(
      new winston.transports.Http({
        handleExceptions: true,
        ...options,
        level,
      }),
    );
  }

  public addStreamTransport(
    level: LogLevel = LogLevel.DEBUG,
    options: StreamTransportOptions,
  ): void {
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

  private getFilteredDetails(details: LogDetails): LogDetails {
    if (!isObject(details)) return details;
    if (isError(details)) return details;

    const result = clone(details);

    for (const filter of this.filter) {
      const data = get(details, filter.path);

      if (!data) continue;

      const callback = filter.callback || defaultFilterCallback;

      set(result, filter.path, callback(data));
    }

    return result;
  }
}
