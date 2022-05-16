import Timeout = NodeJS.Timeout;
import { EventEmitter } from "events";
import { Logger } from "@lindorm-io/winston";

type Callback = () => Promise<void>;
type OnError = (error: Error, worker: IntervalWorker) => Promise<void>;

interface Options {
  callback: Callback;
  logger: Logger;
  retry?: number;
  onError?: OnError;
  time: number;
}

export enum IntervalWorkerEvent {
  START = "interval_worker_start",
  STOP = "interval_worker_stop",
  SUCCESS = "interval_worker_success",
  ERROR = "interval_worker_error",
}

const sleep = (time: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, time));

export class IntervalWorker extends EventEmitter {
  private readonly callback: Callback;
  private readonly onError: OnError | undefined;
  private readonly logger: Logger;
  private readonly retry: number | undefined;
  private readonly time: number;

  private interval: Timeout | undefined;

  public constructor(options: Options) {
    super();

    this.callback = options.callback;
    this.onError = options.onError;

    this.interval = undefined;
    this.retry = options.retry;
    this.time = options.time;

    this.logger = options.logger.createChildLogger("interval-worker");
  }

  public trigger(attempt = 0): void {
    this.logger.debug("worker trigger");

    this.callback()
      .then((result: any) => {
        this.logger.debug("worker success", result ? { result } : undefined);
        super.emit(IntervalWorkerEvent.SUCCESS, { result });
      })
      .catch((err: Error) => {
        this.logger.error("worker error", err);
        super.emit(IntervalWorkerEvent.ERROR, err);

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

    super.emit(IntervalWorkerEvent.START);
  }

  public stop(): void {
    this.logger.debug("worker stop");

    if (this.interval) {
      clearInterval(this.interval);

      this.interval = undefined;
    }

    super.emit(IntervalWorkerEvent.STOP);
  }

  public static get Event(): Record<string, IntervalWorkerEvent> {
    return IntervalWorkerEvent;
  }
}
