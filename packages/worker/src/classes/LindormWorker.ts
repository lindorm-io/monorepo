import { isReadableTime, ms } from "@lindorm/date";
import { isNumber } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { calculateRetry, RetryConfig } from "@lindorm/retry";
import { noopAsync, sleep } from "@lindorm/utils";
import { EventEmitter } from "events";
import { LindormWorkerError } from "../errors";
import { ILindormWorker } from "../interfaces";
import { RETRY_CONFIG } from "../internal";
import {
  LindormWorkerCallback,
  LindormWorkerContext,
  LindormWorkerErrorCallback,
  LindormWorkerErrorListener,
  LindormWorkerEvent,
  LindormWorkerHealth,
  LindormWorkerListener,
  LindormWorkerOptions,
} from "../types";

export class LindormWorker implements ILindormWorker {
  public readonly alias: string;

  private readonly callback: LindormWorkerCallback;
  private readonly callbackTimeout: number;
  private readonly errorCallback: LindormWorkerErrorCallback;

  private readonly emitter: EventEmitter;
  private readonly interval: number;
  private readonly logger: ILogger;
  private readonly jitter: number;
  private readonly retry: RetryConfig;

  private _destroyed: boolean;
  private _latestError: Date | null;
  private _latestStart: Date | null;
  private _latestStop: Date | null;
  private _latestSuccess: Date | null;
  private _latestTry: Date | null;
  private _running: boolean;
  private _runPromise: Promise<void> | null;
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
    this.jitter = isReadableTime(options.jitter)
      ? ms(options.jitter)
      : isNumber(options.jitter)
        ? options.jitter
        : 0;
    this.interval = isReadableTime(options.interval)
      ? ms(options.interval)
      : options.interval;
    this.callbackTimeout = isReadableTime(options.callbackTimeout)
      ? ms(options.callbackTimeout)
      : isNumber(options.callbackTimeout)
        ? options.callbackTimeout
        : 0;

    if (this.interval <= 0) {
      throw new LindormWorkerError("Interval must be a positive number");
    }
    if (this.jitter < 0) {
      throw new LindormWorkerError("Jitter must be a non-negative number");
    }
    if (this.callbackTimeout < 0) {
      throw new LindormWorkerError("Callback timeout must be a non-negative number");
    }

    this._destroyed = false;
    this._latestError = null;
    this._latestStart = null;
    this._latestStop = null;
    this._latestSuccess = null;
    this._latestTry = null;
    this._running = false;
    this._runPromise = null;
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

  public on(evt: "start", listener: LindormWorkerListener): void;
  public on(evt: "stop", listener: LindormWorkerListener): void;
  public on(evt: "success", listener: LindormWorkerListener): void;
  public on(evt: "error", listener: LindormWorkerErrorListener): void;
  public on(evt: "warning", listener: LindormWorkerErrorListener): void;
  public on(evt: LindormWorkerEvent, listener: (...args: any[]) => void): void {
    this.assertNotDestroyed();
    this.emitter.on(evt, listener);
  }

  public off(evt: "start", listener: LindormWorkerListener): void;
  public off(evt: "stop", listener: LindormWorkerListener): void;
  public off(evt: "success", listener: LindormWorkerListener): void;
  public off(evt: "error", listener: LindormWorkerErrorListener): void;
  public off(evt: "warning", listener: LindormWorkerErrorListener): void;
  public off(evt: LindormWorkerEvent, listener: (...args: any[]) => void): void {
    this.assertNotDestroyed();
    this.emitter.off(evt, listener);
  }

  public once(evt: "start", listener: LindormWorkerListener): void;
  public once(evt: "stop", listener: LindormWorkerListener): void;
  public once(evt: "success", listener: LindormWorkerListener): void;
  public once(evt: "error", listener: LindormWorkerErrorListener): void;
  public once(evt: "warning", listener: LindormWorkerErrorListener): void;
  public once(evt: LindormWorkerEvent, listener: (...args: any[]) => void): void {
    this.assertNotDestroyed();
    this.emitter.once(evt, listener);
  }

  public health(): LindormWorkerHealth {
    return {
      alias: this.alias,
      started: this._started,
      running: this._running,
      destroyed: this._destroyed,
      seq: this._seq,
      latestSuccess: this._latestSuccess,
      latestError: this._latestError,
      latestTry: this._latestTry,
    };
  }

  public start(): void {
    this.assertNotDestroyed();

    if (this._started) return;
    if (this._timeout) return;

    this.logger.debug("Starting worker");
    this.emitter.emit("start");

    this._started = true;
    this._latestStart = new Date();

    void this.run();
  }

  public async stop(): Promise<void> {
    if (!this._timeout && !this._running) return;

    this.logger.debug("Stopping worker");
    this.emitter.emit("stop");

    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    this._started = false;

    if (this._runPromise) {
      await this._runPromise;
    }

    this._running = false;
    this._latestStop = new Date();
  }

  public async destroy(): Promise<void> {
    this.assertNotDestroyed();

    await this.stop();
    this.emitter.removeAllListeners();
    this._destroyed = true;
  }

  public async trigger(): Promise<void> {
    this.assertNotDestroyed();

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

    this._runPromise = this.executeRun(attempt);
    return this._runPromise;
  }

  private async executeRun(attempt: number): Promise<void> {
    return this.invokeCallback()
      .then(() => {
        this.logger.debug("Worker callback success");
        this.emitter.emit("success");

        this._latestSuccess = new Date();

        this.cleanup();
      })
      .catch((error: any) => {
        const err =
          error instanceof LindormWorkerError
            ? error
            : new LindormWorkerError(error.message, { error });

        this.logger.debug("Worker callback error", err);

        if (attempt < this.retry.maxAttempts) {
          this.emitter.emit("warning", err);

          return sleep(calculateRetry(attempt, this.retry)).then(() =>
            this.run(attempt + 1),
          );
        } else {
          this.emitter.emit("error", err);

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

  private async invokeCallback(): Promise<void> {
    const callbackPromise = this.callback(this.ctx());

    if (this.callbackTimeout > 0) {
      const timeoutPromise = sleep(this.callbackTimeout).then(() => {
        throw new LindormWorkerError("Callback timed out", {
          data: { timeout: this.callbackTimeout },
        });
      });
      await Promise.race([callbackPromise, timeoutPromise]);
    } else {
      await callbackPromise;
    }
  }

  private cleanup(): void {
    this._running = false;
    this._runPromise = null;

    if (this._started) {
      this._timeout = setTimeout(() => this.run(), this.jitterInterval());
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

  private jitterInterval(): number {
    return this.interval + Math.floor((Math.random() - 0.5) * 2 * this.jitter);
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new LindormWorkerError("Worker has been destroyed");
    }
  }
}
