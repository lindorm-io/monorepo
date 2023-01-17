import clone from "clone";
import merge from "merge";
import { LogLevel } from "../enum";
import { defaultFilterCallback } from "../util";
import { get, set } from "object-path";
import { isObject } from "@lindorm-io/core";
import { snakeCase } from "@lindorm-io/case";
import {
  ConsoleOptions,
  FilterCallback,
  FilterRecord,
  Level,
  LogContext,
  LogDetails,
  LogSession,
  Logger,
  LoggerMessage,
  LoggerOptions,
} from "../types";

export abstract class LoggerBase implements Logger {
  public readonly className: string;

  private _context: Array<string>;
  private _filters: FilterRecord;
  private _session: LogSession;

  protected constructor(options: LoggerOptions = {}) {
    const { context = [], filters = {}, parent, session = {} } = options;

    this.className = this.constructor.name;

    this._context = parent ? [parent.context, snakeCase(context)].flat() : snakeCase(context);
    this._filters = parent ? { ...parent.filters, ...filters } : filters;
    this._session = parent ? merge(clone(parent.session), session) : session;
  }

  // public abstract

  public abstract addConsole(level: Level, options: Partial<ConsoleOptions>): void;

  public abstract createChildLogger(context: LogContext): Logger;

  public abstract createSessionLogger(session: LogSession): Logger;

  // protected abstract

  protected abstract log(options: LoggerMessage): void;

  // public properties

  public get context(): Array<string> {
    return clone(this._context);
  }

  public set context(_: Array<string>) {
    /* ignored */
  }

  public get filters(): FilterRecord {
    return clone(this._filters);
  }

  public set filters(_: FilterRecord) {
    /* ignored */
  }

  public get session(): LogSession {
    return clone(this._session);
  }

  public set session(_: LogSession) {
    /* ignored */
  }

  // public logger

  public error(message: string, details?: LogDetails): void {
    this.handleLog({
      level: LogLevel.ERROR,
      message,
      details: details || null,
      context: this._context,
      session: this._session || {},
      time: new Date(),
    });
  }

  public warn(message: string, details?: LogDetails): void {
    this.handleLog({
      level: LogLevel.WARN,
      message,
      details: details || null,
      context: this._context,
      session: this._session || {},
      time: new Date(),
    });
  }

  public info(message: string, details?: LogDetails): void {
    this.handleLog({
      level: LogLevel.INFO,
      message,
      details: details || null,
      context: this._context,
      session: this._session || {},
      time: new Date(),
    });
  }

  public verbose(message: string, details?: LogDetails): void {
    this.handleLog({
      level: LogLevel.VERBOSE,
      message,
      details: details || null,
      context: this._context,
      session: this._session || {},
      time: new Date(),
    });
  }

  public debug(message: string, details?: LogDetails): void {
    this.handleLog({
      level: LogLevel.DEBUG,
      message,
      details: details || null,
      context: this._context,
      session: this._session || {},
      time: new Date(),
    });
  }

  public silly(message: string, details?: LogDetails): void {
    this.handleLog({
      level: LogLevel.SILLY,
      message,
      details: details || null,
      context: this._context,
      session: this._session || {},
      time: new Date(),
    });
  }

  // public

  public addContext(context: LogContext): void {
    this._context = [this._context, this.normaliseContext(context)].flat();
  }

  public addSession(session: LogSession): void {
    this._session = merge(clone(this._session), this.normaliseSession(session));
  }

  public setFilter(path: string, callback?: FilterCallback): void {
    this._filters[path] = callback || defaultFilterCallback;
  }

  public deleteFilter(path: string): void {
    this._filters[path] = undefined;
  }

  public clearFilters(): void {
    this._filters = {};
  }

  // protected

  protected normaliseContext(context: LogContext): Array<string> {
    if (!Array.isArray(context) && typeof context !== "string" && typeof context !== "number") {
      throw new Error(`Invalid context type [ ${typeof context} ]`);
    }

    return snakeCase(
      Array.isArray(context)
        ? context
        : typeof context === "string"
        ? [context]
        : [context.toString()],
    );
  }

  protected normaliseSession(session: LogSession): LogSession {
    if (!isObject(session)) {
      throw new Error(`Invalid session type [ ${typeof session} ]`);
    }
    return session;
  }

  // private

  private getFilteredDetails(details: LogDetails): LogDetails {
    if (!isObject(details)) return details;
    if (details instanceof Error) return details;

    const data = clone(details);

    for (const [path, callback] of Object.entries(this.filters)) {
      if (!callback) continue;

      const item = get(data, path);
      if (!item) continue;

      set(data, path, callback(item));
    }

    return data;
  }

  private handleLog(options: LoggerMessage): void {
    this.log({
      ...options,
      details: this.getFilteredDetails(options.details),
    });
  }
}
