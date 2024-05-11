import { Logger } from "@lindorm/logger";
import { RetryConfig, calculateRetry } from "@lindorm/retry";
import { sleep } from "@lindorm/utils";
import { EventEmitter } from "events";
import { _RETRY_CONFIG } from "../constants/private/defaults";
import { LindormWorkerEvent } from "../enums";
import { LindormWorkerOptions, WorkerCallback } from "../types";

export class LindormWorker {
  private readonly _callback: WorkerCallback;
  private readonly _emitter: EventEmitter;
  private readonly _interval: number;
  private readonly _logger: Logger;
  private readonly _retry: RetryConfig;

  private _executing: boolean;
  private _latestError: Date | null;
  private _latestSuccess: Date | null;
  private _latestTry: Date | null;
  private _running: boolean;
  private _seq: number;
  private _timeout: NodeJS.Timeout | null;

  public constructor(options: LindormWorkerOptions) {
    this._emitter = new EventEmitter();
    this._logger = options.logger.child(["Worker", options.alias]);

    this._retry = { ..._RETRY_CONFIG, ...(options.retry ?? {}) };
    this._callback = options.callback;
    this._interval = options.interval;

    this._executing = false;
    this._latestError = null;
    this._latestSuccess = null;
    this._latestTry = null;
    this._running = false;
    this._seq = 0;
    this._timeout = null;
  }

  public get executing(): boolean {
    return this._executing;
  }

  public get latestError(): Date | null {
    return this._latestError;
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

  public on(evt: LindormWorkerEvent.Start, listener: () => void): void;
  public on(evt: LindormWorkerEvent.Stop, listener: () => void): void;
  public on(evt: LindormWorkerEvent.Success, listener: (result: string | undefined) => void): void;
  public on(evt: LindormWorkerEvent.Error, listener: (error: Error) => void): void;
  public on(evt: LindormWorkerEvent, listener: (...args: any[]) => void): void {
    this._emitter.on(evt, listener);
  }

  public start(): void {
    if (this._timeout) return;

    this._logger.debug("Starting worker");
    this._emitter.emit(LindormWorkerEvent.Start);

    this.execute();

    this._timeout = setInterval(() => this.execute(), this._interval);
  }

  public stop(): void {
    if (!this._timeout) return;

    this._logger.debug("Stopping worker");
    this._emitter.emit(LindormWorkerEvent.Stop);

    clearInterval(this._timeout);

    this._timeout = null;
  }

  private execute(attempt = 0): void {
    if (this._running) return;
    if (this._executing && attempt === 0) return;

    this._executing = true;
    this._running = true;

    if (attempt === 0) {
      this._logger.debug("Executing worker callback");
    } else {
      this._logger.debug("Retrying worker callback", { attempt });
    }

    this._latestTry = new Date();
    this._seq++;

    this._callback({
      latestError: this._latestError,
      latestSuccess: this._latestSuccess,
      latestTry: this._latestTry,
      logger: this._logger,
      seq: this._seq,
    })
      .then((result) => {
        this._logger.debug("Worker callback success", { result });
        this._emitter.emit(LindormWorkerEvent.Success, result);

        this._executing = false;
        this._running = false;
        this._latestSuccess = new Date();
      })
      .catch((err) => {
        this._logger.debug("Worker callback error", err);

        this._latestError = new Date();

        if (attempt <= this._retry.maxAttempts) {
          sleep(calculateRetry(attempt, this._retry)).then(() => this.execute(attempt + 1));
        } else {
          this._emitter.emit(LindormWorkerEvent.Error, err);

          this._executing = false;
          this._running = false;
          this._logger.debug("Will not attempt any further retries", {
            attempt,
            maxAttempts: this._retry.maxAttempts,
          });
        }
      });
  }
}
