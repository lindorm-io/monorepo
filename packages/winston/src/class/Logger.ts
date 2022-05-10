import { LogLevel } from "../enum";
import { WinstonInstance } from "./WinstonInstance";
import { clone, isArray, isObject, isString } from "lodash";
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
} from "../types";

export class Logger {
  private readonly context: Array<string>;
  private readonly winston: WinstonInstance;
  private session: Record<string, any> | undefined;

  public constructor(options: LoggerOptions = {}) {
    if (options.parent) {
      this.context = clone(options.parent.context);
      this.winston = options.parent.winston;
    } else {
      this.context = [];
      this.winston = new WinstonInstance(options);
    }

    if (options.session) {
      this.session = options.session;
    } else if (options.parent) {
      this.session = clone(options.parent.session);
    }

    this.addContext(options.context || []);
  }

  // public

  public error(message: string, details?: LogDetails): void {
    this.winston.log({
      level: LogLevel.ERROR,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public warn(message: string, details?: LogDetails): void {
    this.winston.log({
      level: LogLevel.WARN,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public info(message: string, details?: LogDetails): void {
    this.winston.log({
      level: LogLevel.INFO,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public verbose(message: string, details?: LogDetails): void {
    this.winston.log({
      level: LogLevel.VERBOSE,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public debug(message: string, details?: LogDetails): void {
    this.winston.log({
      level: LogLevel.DEBUG,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public silly(message: string, details?: LogDetails): void {
    this.winston.log({
      level: LogLevel.SILLY,
      message,
      details: details || null,
      context: this.context,
      session: this.session || {},
    });
  }

  public createChildLogger(context: ChildLoggerContext): Logger {
    if (!isString(context) && !isArray(context)) {
      throw new Error("Invalid logger context");
    }

    return new Logger({ context, parent: this });
  }

  public createSessionLogger(session: Record<string, any>): Logger {
    if (!isObject(session)) {
      throw new Error("Invalid logger session");
    }

    if (this.session) {
      throw new Error("Logger session already exists");
    }

    return new Logger({ session, parent: this });
  }

  public addSessionMetadata(metadata: SessionMetadata): void {
    if (!this.session) {
      throw new Error("Logger session not found");
    }

    this.session = {
      ...this.session,
      metadata,
    };
  }

  public addFilter(path: string, callback?: FilterCallback): void {
    this.winston.addFilter(path, callback);
  }

  public setFocus(focus: string | null): void {
    this.winston.setFocus(focus);
  }

  public addConsole(level: LogLevel = LogLevel.DEBUG, readable?: boolean): void {
    this.winston.addConsole(level, readable);
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
}
