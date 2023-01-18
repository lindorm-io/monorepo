import * as winston from "winston";
import { WinstonOptions } from "../types";
import { readableFormat } from "../util";
import {
  ConsoleOptions,
  Level,
  LogContext,
  LogLevel,
  LogSession,
  Logger,
  LoggerBase,
  LoggerMessage,
} from "@lindorm-io/core-logger";
import {
  FileTransportOptions,
  HttpTransportOptions,
  StreamTransportOptions,
} from "winston/lib/winston/transports";

export class WinstonLogger extends LoggerBase implements Logger {
  public readonly winston: winston.Logger;

  public constructor(options: WinstonOptions = {}) {
    super(options);

    this.winston = options.parent ? options.parent.winston : winston.createLogger();
  }

  public addConsole(level: Level = LogLevel.DEBUG, options: Partial<ConsoleOptions> = {}): void {
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

  public addFileTransport(level: LogLevel, options: FileTransportOptions): void {
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

  public createChildLogger(context: LogContext): Logger {
    return new WinstonLogger({ parent: this, context: this.normaliseContext(context) });
  }

  public createSessionLogger(session: LogSession): Logger {
    return new WinstonLogger({ parent: this, session: this.normaliseSession(session) });
  }

  protected log(options: LoggerMessage): void {
    this.winston.log({
      context: options.context,
      details: options.details,
      level: options.level,
      message: options.message,
      session: options.session,
      time: new Date(),
    });
  }
}
