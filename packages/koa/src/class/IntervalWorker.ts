import Timeout = NodeJS.Timeout;
import { EventEmitter } from "events";
import { ILogger } from "@lindorm-io/winston";
import { sleep } from "@lindorm-io/core";

type Callback = () => Promise<void>;
type OnError = (error: Error, worker: IntervalWorker) => Promise<void>;

interface Options {
  callback: Callback;
  logger: ILogger;
  onError?: OnError;
  retry?: number;
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
  private readonly logger: ILogger;
  private readonly onError: OnError | undefined;
  private readonly retry: number | undefined;
  private readonly time: number;
  private interval: Timeout | undefined;

  public constructor(options: Options) {
    this.callback = options.callback;
    this.onError = options.onError;

    this.interval = undefined;
    this.retry = options.retry;
    this.time = options.time;

    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.createChildLogger(["IntervalWorker"]);
  }

  public on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  public trigger(attempt = 0): void {
    this.logger.debug("worker trigger");

    this.callback()
      .then((result: any) => {
        this.logger.debug("worker success", result ? { result } : undefined);
        this.eventEmitter.emit(IntervalWorkerEvent.SUCCESS, { result });
      })
      .catch((err: Error) => {
        this.logger.error("worker error", err);
        this.eventEmitter.emit(IntervalWorkerEvent.ERROR, err);

        if (this.onError) {
          this.onError(err, this).then();
        }

        if (attempt <= this.retry) {
          const timeout = attempt * 250;
          this.logger.debug("retrying", { attempt, timeout });
          sleep(timeout).then(() => this.trigger(attempt + 1));
        } else {
          this.logger.debug("will not attempt any further retries", {
            attempt,
            maximum: this.retry,
          });
        }
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

  public static get Event(): Record<string, IntervalWorkerEvent> {
    return IntervalWorkerEvent;
  }
}
