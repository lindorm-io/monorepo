import pc from "picocolors";
import winston from "winston";
import type { ILogger, ILoggerRoot } from "../interfaces/index.js";
import type { FilterCallback, LogLevel, LoggerOptions } from "../types/index.js";
import type { StdLogger } from "../types/index.js";
import type { LoggerBaseOptions } from "../internal/types/logger-base-options.js";
import type { InternalLog } from "../internal/types/internal-log.js";
import { defaultFilterCallback } from "../internal/utils/default-filter-callback.js";
import { setProcessErrorRoute } from "../internal/utils/process-error-route.js";
import { readableFormat } from "../internal/utils/readable-format.js";
import { LoggerBase } from "./LoggerBase.js";
import { LoggerChild } from "./LoggerChild.js";

export class Logger extends LoggerBase implements ILoggerRoot {
  public static std: StdLogger = {
    log: (msg: string) => console.log(msg),
    info: (msg: string) => console.info(pc.green(msg)),
    success: (msg: string) => console.log(pc.green(msg)),
    warn: (msg: string) => console.warn(pc.yellow(msg)),
    error: (msg: string) => console.error(pc.red(msg)),
    debug: (msg: string) => console.debug(pc.blue(msg)),
  };

  public constructor(options: LoggerOptions = {}) {
    const filters = options.filters ?? {};
    const winstonInstance = winston.createLogger();
    const logLevel = options.level ?? "info";
    const readable = options.readable ?? false;

    winstonInstance.add(
      new winston.transports.Console({
        level: logLevel,
        format: readable
          ? winston.format.printf((log) => readableFormat(log as InternalLog))
          : winston.format.json(),
      }),
    );

    super({
      correlation: options.correlation ?? {},
      filters,
      filterRef: { entries: Object.entries(filters) },
      keyFilterRef: { exact: new Map(), patterns: [] },
      scope: options.scope ?? [],
      timers: new Map(),
      winston: winstonInstance,
    });

    setProcessErrorRoute((error) => this.error(error));
  }

  protected spawnChild(options: LoggerBaseOptions): ILogger {
    return new LoggerChild(options);
  }

  // root-only mutators — config that touches shared infrastructure
  // (winston level applies across every transport and every child;
  // filters live in a registry shared by reference with every child).

  public override get level(): LogLevel {
    return super.level;
  }

  public override set level(level: LogLevel) {
    this.winston.level = level;
    this.winston.transports.forEach((t) => {
      t.level = level;
    });
  }

  public filterPath(path: string, callback?: FilterCallback): void {
    this.filters[path] = callback ?? defaultFilterCallback;
    this.filterRef.entries = Object.entries(this.filters);
  }

  public filterKey(key: string, callback?: FilterCallback): void;
  public filterKey(pattern: RegExp, callback?: FilterCallback): void;
  public filterKey(keyOrPattern: string | RegExp, callback?: FilterCallback): void {
    const cb = callback ?? defaultFilterCallback;
    if (typeof keyOrPattern === "string") {
      this.keyFilterRef.exact.set(keyOrPattern, cb);
    } else {
      this.keyFilterRef.patterns.push([keyOrPattern, cb]);
    }
  }
}
