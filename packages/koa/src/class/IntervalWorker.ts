import { EventEmitter } from "events";
import { Logger } from "@lindorm-io/core-logger";
import { calculateRetry, RetryOptions, sleep } from "@lindorm-io/retry";

type Callback = () => Promise<void>;
type OnError = (error: Error, worker: IntervalWorker) => Promise<void>;

interface Options {
  callback: Callback;
  onError?: OnError;
  retry?: Partial<RetryOptions>;
  time: number;
}

export enum IntervalWorkerEvent {
  START = "interval_worker_start",
  STOP = "interval_worker_stop",
  SUCCESS = "interval_worker_success",
  ERROR = "interval_worker_error",
}

export class IntervalWorker {
  private readonly callback: Callback;
  private readonly eventEmitter: EventEmitter;
  private readonly logger: Logger;
  private readonly onError: OnError | undefined;
  private readonly retry: RetryOptions;
  private readonly time: number;
  private active: boolean;
  private interval: NodeJS.Timeout | undefined;
  private triggered: number;

  public constructor(options: Options, logger: Logger) {
    this.callback = options.callback;
    this.onError = options.onError;

    this.active = false;
    this.retry = {
      maximumAttempts: options.retry?.maximumAttempts || 3,
      maximumMilliseconds: options.retry?.maximumMilliseconds || 30000,
      milliseconds: options.retry?.milliseconds || 500,
      strategy: options.retry?.strategy || "exponential",
    };
    this.time = options.time;
    this.triggered = 0;

    this.eventEmitter = new EventEmitter();
    this.logger = logger.createChildLogger(["IntervalWorker"]);
  }

  // public properties

  public get isActive(): boolean {
    return this.active;
  }

  public set isActive(_: boolean) {
    /* ignored */
  }

  public get triggerAmount(): number {
    return this.triggered;
  }

  public set triggerAmount(_: number) {
    /* ignored */
  }

  // public event handlers

  public on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  // public

  public trigger(attempt = 0): void {
    this.logger.debug("worker trigger");

    if (this.active) {
      this.logger.debug("worker already active");
      return;
    }

    this.active = true;

    this.callback()
      .then((result: any) => {
        this.logger.debug("worker success", result ? { result } : undefined);
        this.eventEmitter.emit(IntervalWorkerEvent.SUCCESS, { result });
      })
      .catch((err: Error) => {
        this.logger.error("worker error", err);
        this.eventEmitter.emit(IntervalWorkerEvent.ERROR, err);

        if (attempt <= this.retry.maximumAttempts) {
          const timeout = calculateRetry(attempt, this.retry);

          this.logger.debug("retrying failed attempt", { attempt, timeout });

          sleep(timeout).then(() => this.trigger(attempt + 1));
        } else {
          this.logger.debug("will not attempt any further retries", {
            attempt,
            maximumAttempts: this.retry.maximumAttempts,
          });

          if (this.onError) {
            this.onError(err, this).then();
          }
        }
      })
      .finally(() => {
        this.triggered += 1;
        this.active = false;
      });
  }

  public start(): void {
    this.logger.debug("worker start", { intervalMs: this.time });
    this.interval = setInterval(() => this.trigger(), this.time);

    this.eventEmitter.emit(IntervalWorkerEvent.START);
  }

  public stop(): void {
    this.logger.debug("worker stop");

    if (this.interval) {
      clearInterval(this.interval);

      this.interval = undefined;
    }

    this.eventEmitter.emit(IntervalWorkerEvent.STOP);
  }

  public static get Event(): typeof IntervalWorkerEvent {
    return IntervalWorkerEvent;
  }
}
