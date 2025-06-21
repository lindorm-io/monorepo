import { isReadableTime, ms } from "@lindorm/date";
import { LindormError } from "@lindorm/errors";
import { isNumber } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { calculateRetry, RetryConfig } from "@lindorm/retry";
import { noopAsync, sleep } from "@lindorm/utils";
import { EventEmitter } from "events";
import { RETRY_CONFIG } from "../constants/private";
import { LindormWorkerEvent } from "../enums";
import { ILindormWorker } from "../interfaces";
import {
  LindormWorkerCallback,
  LindormWorkerContext,
  LindormWorkerErrorCallback,
  LindormWorkerErrorListener,
  LindormWorkerListener,
  LindormWorkerOptions,
} from "../types";

export class LindormWorker implements ILindormWorker {
  public readonly alias: string;

  private readonly callback: LindormWorkerCallback;
  private readonly errorCallback: LindormWorkerErrorCallback;

  private readonly emitter: EventEmitter;
  private readonly interval: number;
  private readonly logger: ILogger;
  private readonly randomize: number;
  private readonly retry: RetryConfig;

  private _latestError: Date | null;
  private _latestStart: Date | null;
  private _latestStop: Date | null;
  private _latestSuccess: Date | null;
  private _latestTry: Date | null;
  private _running: boolean;
  private _seq: number;
  private _started: boolean;
  private _timeout: NodeJS.Timeout | null;

  public constructor(options: LindormWorkerOptions) {
    this.emitter = new EventEmitter();
    this.logger = options.logger.child(["LindormWorker", options.alias]);

    this.callback = options.callback;
    this.errorCallback = options.errorCallback ?? noopAsync;

    this.alias = options.alias;
    this.retry = { ...RETRY_CONFIG, ...(options.retry ?? {}) };
    this.randomize = isReadableTime(options.randomize)
      ? ms(options.randomize)
      : isNumber(options.randomize)
        ? options.randomize
        : 0;
    this.interval = isReadableTime(options.interval)
      ? ms(options.interval)
      : options.interval;

    this._latestError = null;
    this._latestStart = null;
    this._latestStop = null;
    this._latestSuccess = null;
    this._latestTry = null;
    this._running = false;
    this._seq = 0;
    this._started = false;
    this._timeout = null;

    for (const listener of options.listeners ?? []) {
      this.emitter.on(listener.event, listener.listener);
    }
  }

  public get latestError(): Date | null {
    return this._latestError;
  }

  public get latestStart(): Date | null {
    return this._latestStart;
  }

  public get latestStop(): Date | null {
    return this._latestStop;
  }

  public get latestSuccess(): Date | null {
    return this._latestSuccess;
  }

  public get latestTry(): Date | null {
    return this._latestTry;
  }

  public get running(): boolean {
    return this._running;
  }

  public get seq(): number {
    return this._seq;
  }

  public get started(): boolean {
    return this._started;
  }

  public on(evt: LindormWorkerEvent.Start, listener: LindormWorkerListener): void;
  public on(evt: LindormWorkerEvent.Stop, listener: LindormWorkerListener): void;
  public on(evt: LindormWorkerEvent.Success, listener: LindormWorkerListener): void;
  public on(evt: LindormWorkerEvent.Error, listener: LindormWorkerErrorListener): void;
  public on(evt: LindormWorkerEvent.Warning, listener: LindormWorkerErrorListener): void;
  public on(evt: LindormWorkerEvent, listener: (...args: any[]) => void): void {
    this.emitter.on(evt, listener);
  }

  public start(): void {
    if (this._started) return;
    if (this._timeout) return;

    this.logger.debug("Starting worker");
    this.emitter.emit(LindormWorkerEvent.Start);

    this._started = true;
    this._latestStart = new Date();

    this.run();
  }

  public stop(): void {
    if (!this._timeout) return;

    this.logger.debug("Stopping worker");
    this.emitter.emit(LindormWorkerEvent.Stop);

    clearTimeout(this._timeout);

    this._timeout = null;
    this._started = false;
    this._latestStop = new Date();
  }

  public async trigger(): Promise<void> {
    return this.run();
  }

  // private

  private async run(attempt = 0): Promise<void> {
    if (this._running && attempt === 0) return;

    this._running = true;
    this._latestTry = new Date();

    if (attempt === 0) {
      this._seq++;
      this.logger.debug("Running worker callback");
    } else {
      this.logger.debug("Retrying worker callback", { attempt });
    }

    return this.callback(this.ctx())
      .then(() => {
        this.logger.debug("Worker callback success");
        this.emitter.emit(LindormWorkerEvent.Success);

        this._latestSuccess = new Date();

        this.cleanup();
      })
      .catch((error: any) => {
        const err =
          error instanceof LindormError
            ? error
            : new LindormError(error.message, { error });

        this.logger.debug("Worker callback error", err);

        if (attempt < this.retry.maxAttempts) {
          this.emitter.emit(LindormWorkerEvent.Warning, err);

          return sleep(calculateRetry(attempt, this.retry)).then(() =>
            this.run(attempt + 1),
          );
        } else {
          this.emitter.emit(LindormWorkerEvent.Error, err);

          this._latestError = new Date();

          this.logger.debug("Will not attempt any further retries for this interval", {
            attempt,
            maxAttempts: this.retry.maxAttempts,
          });

          return this.errorCallback(this.ctx(), err)
            .catch((err) => {
              this.logger.warn("Error in error callback", err);
            })
            .finally(this.cleanup.bind(this));
        }
      });
  }

  private cleanup(): void {
    this._running = false;

    if (this._started) {
      this._timeout = setTimeout(() => this.run(), this.randomizeInterval());
    }
  }

  private ctx(): LindormWorkerContext {
    return {
      latestError: this._latestError,
      latestSuccess: this._latestSuccess,
      latestTry: this._latestTry,
      logger: this.logger.child(["Context"]),
      seq: this._seq,
    };
  }

  private randomizeInterval(): number {
    return this.interval + Math.floor(Math.random() * this.randomize);
  }
}
