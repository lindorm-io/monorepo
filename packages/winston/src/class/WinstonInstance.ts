import * as winston from "winston";
import { LogLevel } from "../enum";
import { LoggerMessage, LoggerTransportOptions } from "../types";
import { readableFormat } from "../util";
import {
  HttpTransportOptions,
  StreamTransportOptions,
  FileTransportOptions,
} from "winston/lib/winston/transports";

export class WinstonInstance {
  private readonly winston: winston.Logger;

  public constructor() {
    this.winston = winston.createLogger();
  }

  // public

  public log(options: LoggerMessage): void {
    this.winston.log({
      level: options.level,
      time: new Date(),
      message: options.message,
      details: options.details,
      context: options.context,
      session: options.session,
    });
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
}
