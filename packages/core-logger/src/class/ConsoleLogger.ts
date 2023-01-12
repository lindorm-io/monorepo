import { LEVEL_VALUE } from "../constant";
import { LogLevel } from "../enum";
import { LoggerBase } from "./LoggerBase";
import { readableFormat } from "../util";
import {
  ConsoleOptions,
  Level,
  LogContext,
  LogSession,
  Logger,
  LoggerMessage,
  LoggerOptions,
} from "../types";

export class ConsoleLogger extends LoggerBase implements Logger {
  private consoleOptions: ConsoleOptions;
  private level: Level;

  public constructor(options: LoggerOptions = {}) {
    super(options);

    this.consoleOptions = { colours: false, readable: false, timestamp: false };
  }

  public addConsole(level: Level = "info", options: Partial<ConsoleOptions> = {}): void {
    this.consoleOptions = { ...this.consoleOptions, ...options };
    this.level = level;
  }

  public createChildLogger(context: LogContext): Logger {
    const logger = new ConsoleLogger({
      parent: this,
      context: this.normaliseContext(context),
    });

    if (!this.level) return logger;

    logger.addConsole(this.level, this.consoleOptions);

    return logger;
  }

  public createSessionLogger(session: LogSession): Logger {
    const logger = new ConsoleLogger({
      parent: this,
      session: this.normaliseSession(session),
    });

    if (!this.level) return logger;

    logger.addConsole(this.level, this.consoleOptions);

    return logger;
  }

  protected log(options: LoggerMessage): void {
    if (!this.level) return;
    if (LEVEL_VALUE[options.level] < LEVEL_VALUE[this.level]) return;

    const data = this.consoleOptions.readable
      ? readableFormat(options, this.consoleOptions)
      : options;

    switch (options.level) {
      case LogLevel.ERROR:
        console.error(data);
        break;

      case LogLevel.WARN:
        console.warn(data);
        break;

      case LogLevel.INFO:
        console.info(data);
        break;

      case LogLevel.DEBUG:
        console.debug(data);
        break;

      default:
        console.log(data);
    }
  }
}
