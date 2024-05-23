import { ILogger } from "@lindorm/logger";
import { RetryConfig, calculateRetry } from "@lindorm/retry";
import { sleep } from "@lindorm/utils";
import { EventEmitter } from "events";
import { RETRY_CONFIG } from "../constants/private/defaults";
import { LindormWorkerEvent } from "../enums";
import { ILindormWorker, LindormWorkerOptions, WorkerCallback } from "../types";

export class LindormWorker implements ILindormWorker {
  private readonly callback: WorkerCallback;
  private readonly emitter: EventEmitter;
  private readonly interval: number;
  private readonly logger: ILogger;
  private readonly retry: RetryConfig;
  private timeout: NodeJS.Timeout | null;

  private _executing: boolean;
  private _latestError: Date | null;
  private _latestSuccess: Date | null;
  private _latestTry: Date | null;
  private _running: boolean;
  private _seq: number;

  public constructor(options: LindormWorkerOptions) {
    this.emitter = new EventEmitter();
    this.logger = options.logger.child(["Worker", options.alias]);

    this.retry = { ...RETRY_CONFIG, ...(options.retry ?? {}) };
    this.callback = options.callback;
    this.interval = options.interval;

    this._executing = false;
    this._latestError = null;
    this._latestSuccess = null;
    this._latestTry = null;
    this._running = false;
    this._seq = 0;
    this.timeout = null;
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
  public on(
    evt: LindormWorkerEvent.Success,
    listener: (result: string | undefined) => void,
  ): void;
  public on(evt: LindormWorkerEvent.Error, listener: (error: Error) => void): void;
  public on(evt: LindormWorkerEvent, listener: (...args: any[]) => void): void {
    this.emitter.on(evt, listener);
  }

  public start(): void {
    if (this.timeout) return;

    this.logger.debug("Starting worker");
    this.emitter.emit(LindormWorkerEvent.Start);

    this.execute();

    this.timeout = setInterval(() => this.execute(), this.interval);
  }

  public stop(): void {
    if (!this.timeout) return;

    this.logger.debug("Stopping worker");
    this.emitter.emit(LindormWorkerEvent.Stop);

    clearInterval(this.timeout);

    this.timeout = null;
  }

  private execute(attempt = 0): void {
    if (this._running) return;
    if (this._executing && attempt === 0) return;

    this._executing = true;
    this._running = true;

    if (attempt === 0) {
      this.logger.debug("Executing worker callback");
    } else {
      this.logger.debug("Retrying worker callback", { attempt });
    }

    this._latestTry = new Date();
    this._seq++;

    this.callback({
      latestError: this._latestError,
      latestSuccess: this._latestSuccess,
      latestTry: this._latestTry,
      logger: this.logger,
      seq: this._seq,
    })
      .then((result) => {
        this.logger.debug("Worker callback success", { result });
        this.emitter.emit(LindormWorkerEvent.Success, result);

        this._executing = false;
        this._running = false;
        this._latestSuccess = new Date();
      })
      .catch((err) => {
        this.logger.debug("Worker callback error", err);

        this._latestError = new Date();

        if (attempt <= this.retry.maxAttempts) {
          sleep(calculateRetry(attempt, this.retry)).then(() =>
            this.execute(attempt + 1),
          );
        } else {
          this.emitter.emit(LindormWorkerEvent.Error, err);

          this._executing = false;
          this._running = false;
          this.logger.debug("Will not attempt any further retries", {
            attempt,
            maxAttempts: this.retry.maxAttempts,
          });
        }
      });
  }
}
