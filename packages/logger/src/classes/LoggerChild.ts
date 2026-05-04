import type { ILogger } from "../interfaces/index.js";
import type { LoggerBaseOptions } from "../internal/types/logger-base-options.js";
import { LoggerBase } from "./LoggerBase.js";

// Internal child logger returned by `Logger#child()` (and chained calls).
// Inherits shared infrastructure (winston, filter refs, timer map) from a
// parent and carries its own merged scope/correlation. Not exported from
// the package — consumers always see an `ILogger`.
export class LoggerChild extends LoggerBase {
  public constructor(options: LoggerBaseOptions) {
    super(options);
  }

  protected spawnChild(options: LoggerBaseOptions): ILogger {
    return new LoggerChild(options);
  }
}
