import { isError } from "@lindorm/is";
import pc from "picocolors";
import winston from "winston";
import type { ILogger } from "../interfaces/index.js";
import type { LoggerOptions } from "../types/index.js";
import type { StdLogger } from "../types/index.js";
import type { LoggerBaseOptions } from "../internal/types/logger-base-options.js";
import type { InternalLog } from "../internal/types/internal-log.js";
import { readableFormat } from "../internal/utils/readable-format.js";
import { LoggerBase } from "./LoggerBase.js";
import { LoggerChild } from "./LoggerChild.js";

// Module-level routing for uncaughtException / unhandledRejection. We attach
// process listeners once for the lifetime of the module, then forward to the
// most-recently-constructed Logger so its scope/correlation/filters apply.
// Per-Logger `process.on(...)` would accumulate listeners (and hit Node's
// MaxListeners warning) every time a fresh Logger is built — common in tests.
let processHandlersInstalled = false;
let activeRoute: ((error: Error) => void) | null = null;

const installProcessHandlers = (): void => {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;

  process.on("uncaughtException", (err: unknown) => {
    if (!activeRoute) return;
    activeRoute(isError(err) ? err : new Error(String(err)));
  });

  process.on("unhandledRejection", (reason: unknown) => {
    if (!activeRoute) return;
    activeRoute(isError(reason) ? reason : new Error(String(reason)));
  });
};

const setActiveRoute = (route: (error: Error) => void): void => {
  activeRoute = route;
};

export class Logger extends LoggerBase {
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

    installProcessHandlers();
    setActiveRoute((error) => this.error(error));
  }

  protected spawnChild(options: LoggerBaseOptions): ILogger {
    return new LoggerChild(options);
  }
}
