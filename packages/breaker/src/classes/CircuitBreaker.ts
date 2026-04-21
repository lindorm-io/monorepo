import { EventEmitter } from "events";
import { CircuitOpenError } from "../errors/CircuitOpenError.js";
import type { ICircuitBreaker } from "../interfaces/CircuitBreaker.js";
import { calculateBackoff, SlidingWindow } from "../internal/index.js";
import type {
  CircuitBreakerOptions,
  CircuitBreakerState,
  ErrorClassification,
  ErrorClassifier,
  StateChangeListener,
} from "../types/circuit-breaker.js";

const DEFAULT_THRESHOLD = 5;
const DEFAULT_WINDOW = 60_000;
const DEFAULT_HALF_OPEN_DELAY = 30_000;
const DEFAULT_HALF_OPEN_BACKOFF = 2;
const DEFAULT_HALF_OPEN_MAX_DELAY = 300_000;

const DEFAULT_CLASSIFIER: ErrorClassifier = (): ErrorClassification => "transient";

export class CircuitBreaker implements ICircuitBreaker {
  private readonly _name: string;
  private readonly classifier: ErrorClassifier;
  private readonly emitter: EventEmitter;
  private readonly threshold: number;
  private readonly halfOpenDelay: number;
  private readonly halfOpenBackoff: number;
  private readonly halfOpenMaxDelay: number;
  private readonly window: SlidingWindow;

  private _state: CircuitBreakerState = "closed";
  private halfOpenAttempts: number = 0;
  private openedAt: number = 0;
  private probePromise: Promise<void> | null = null;
  private resolveProbe: (() => void) | null = null;

  public constructor(options: CircuitBreakerOptions) {
    this._name = options.name;
    this.classifier = options.classifier ?? DEFAULT_CLASSIFIER;
    this.emitter = new EventEmitter();
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.halfOpenDelay = options.halfOpenDelay ?? DEFAULT_HALF_OPEN_DELAY;
    this.halfOpenBackoff = options.halfOpenBackoff ?? DEFAULT_HALF_OPEN_BACKOFF;
    this.halfOpenMaxDelay = options.halfOpenMaxDelay ?? DEFAULT_HALF_OPEN_MAX_DELAY;
    this.window = new SlidingWindow(options.window ?? DEFAULT_WINDOW);
  }

  public get name(): string {
    return this._name;
  }

  public get state(): CircuitBreakerState {
    return this._state;
  }

  public get isOpen(): boolean {
    return this._state === "open";
  }

  public get isClosed(): boolean {
    return this._state === "closed";
  }

  public get isHalfOpen(): boolean {
    return this._state === "half-open";
  }

  public execute = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (this._state === "closed") {
      return this.executeClosed(fn);
    }

    if (this._state === "open") {
      return this.executeOpen(fn);
    }

    // half-open: claim probe if none in-flight, otherwise wait
    if (this.probePromise === null) {
      return this.claimAndRunProbe(fn);
    }

    return this.awaitProbeAndRetry(fn);
  };

  public open = (): void => {
    if (this._state === "open") return;
    this.transitionTo("open");
    this.openedAt = Date.now();
    this.halfOpenAttempts = 0;
    this.window.reset();
  };

  public close = (): void => {
    if (this._state !== "open") return;
    this.transitionTo("half-open");
    this.halfOpenAttempts = 0;
  };

  public on(event: "open", listener: StateChangeListener): void;
  public on(event: "half-open", listener: StateChangeListener): void;
  public on(event: "closed", listener: StateChangeListener): void;
  public on(event: string, listener: StateChangeListener): void {
    this.emitter.on(event, listener);
  }

  public reset = (): void => {
    this.transitionTo("closed");
    this.window.reset();
    this.halfOpenAttempts = 0;
    this.resolveProbeIfPending();
  };

  private executeClosed = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      this.handleClosedError(error as Error);
      throw error;
    }
  };

  private handleClosedError = (error: Error): void => {
    const classification = this.classifier(error);

    if (classification === "ignorable") return;

    if (classification === "permanent") {
      this.transitionTo("open");
      this.openedAt = Date.now();
      return;
    }

    // transient
    this.window.record();

    if (this.window.count() >= this.threshold) {
      this.transitionTo("open");
      this.openedAt = Date.now();
    }
  };

  private executeOpen = async <T>(fn: () => Promise<T>): Promise<T> => {
    const delay = calculateBackoff(
      {
        baseDelay: this.halfOpenDelay,
        multiplier: this.halfOpenBackoff,
        maxDelay: this.halfOpenMaxDelay,
      },
      this.halfOpenAttempts,
    );

    const elapsed = Date.now() - this.openedAt;

    if (elapsed < delay) {
      throw new CircuitOpenError("Circuit is open", {
        debug: {
          name: this._name,
          state: this._state,
          failures: this.window.count(),
        },
      });
    }

    // Probe claim must be synchronous — no await between check and set
    if (this.probePromise === null) {
      this.transitionTo("half-open");
      return this.claimAndRunProbe(fn);
    }

    // A probe is already in-flight
    return this.awaitProbeAndRetry(fn);
  };

  private claimAndRunProbe = async <T>(fn: () => Promise<T>): Promise<T> => {
    this.probePromise = new Promise<void>((resolve) => {
      this.resolveProbe = resolve;
    });

    try {
      const result = await fn();
      this.transitionTo("closed");
      this.halfOpenAttempts = 0;
      this.window.reset();
      return result;
    } catch (error) {
      this.transitionTo("open");
      this.openedAt = Date.now();
      this.halfOpenAttempts += 1;
      throw error;
    } finally {
      this.resolveProbeIfPending();
    }
  };

  private awaitProbeAndRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    await this.probePromise;
    return this.execute(fn);
  };

  private transitionTo = (to: CircuitBreakerState): void => {
    const from = this._state;
    if (from === to) return;

    this._state = to;

    this.emitter.emit(to, {
      name: this._name,
      from,
      to,
      failures: this.window.count(),
      timestamp: Date.now(),
    });
  };

  private resolveProbeIfPending = (): void => {
    if (this.resolveProbe) {
      this.resolveProbe();
      this.resolveProbe = null;
      this.probePromise = null;
    }
  };
}
