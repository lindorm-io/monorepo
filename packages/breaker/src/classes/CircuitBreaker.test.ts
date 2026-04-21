import { CircuitBreaker } from "./CircuitBreaker.js";
import { CircuitOpenError } from "../errors/CircuitOpenError.js";
import type {
  CircuitBreakerOptions,
  ErrorClassification,
  StateChangeEvent,
} from "../types/circuit-breaker.js";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const makeBreaker = (overrides: Partial<CircuitBreakerOptions> = {}): CircuitBreaker =>
    new CircuitBreaker({
      name: "test-breaker",
      threshold: 3,
      window: 10_000,
      halfOpenDelay: 1_000,
      halfOpenBackoff: 2,
      halfOpenMaxDelay: 16_000,
      ...overrides,
    });

  const transientError = new Error("transient failure");
  const permanentError = new Error("permanent failure");
  const ignorableError = new Error("ignorable failure");

  const classifyByMessage = (error: Error): ErrorClassification => {
    if (error.message.includes("permanent")) return "permanent";
    if (error.message.includes("ignorable")) return "ignorable";
    return "transient";
  };

  const collectEvents = (breaker: CircuitBreaker): StateChangeEvent[] => {
    const events: StateChangeEvent[] = [];
    const listener = (e: StateChangeEvent) => events.push(e);
    breaker.on("open", listener);
    breaker.on("half-open", listener);
    breaker.on("closed", listener);
    return events;
  };

  const failN = async (
    breaker: CircuitBreaker,
    n: number,
    error: Error = transientError,
  ): Promise<void> => {
    for (let i = 0; i < n; i++) {
      await breaker.execute(() => Promise.reject(error)).catch(() => {});
    }
  };

  describe("closed state", () => {
    test("should execute fn and return result when closed", async () => {
      const breaker = makeBreaker();

      const result = await breaker.execute(() => Promise.resolve("ok"));

      expect(result).toBe("ok");
      expect(breaker.state).toBe("closed");
    });

    test("should record transient errors in the sliding window", async () => {
      const breaker = makeBreaker();

      await failN(breaker, 2);

      expect(breaker.state).toBe("closed");
    });

    test("should open when transient error count reaches threshold", async () => {
      const breaker = makeBreaker();

      await failN(breaker, 3);

      expect(breaker.state).toBe("open");
    });

    test("should immediately open on permanent error", async () => {
      const breaker = makeBreaker({ classifier: classifyByMessage });

      await breaker.execute(() => Promise.reject(permanentError)).catch(() => {});

      expect(breaker.state).toBe("open");
    });

    test("should throw but not affect state on ignorable error", async () => {
      const breaker = makeBreaker({ classifier: classifyByMessage });

      await expect(breaker.execute(() => Promise.reject(ignorableError))).rejects.toThrow(
        "ignorable failure",
      );

      expect(breaker.state).toBe("closed");

      // Even many ignorable errors should not open the circuit
      await failN(breaker, 10, ignorableError);
      expect(breaker.state).toBe("closed");
    });

    test("should re-throw the original error without wrapping", async () => {
      const breaker = makeBreaker();
      const original = new TypeError("original");

      const caught = await breaker
        .execute(() => Promise.reject(original))
        .catch((e) => e);

      expect(caught).toBe(original);
    });

    test("should not count failures that have decayed outside the window", async () => {
      const breaker = makeBreaker({ threshold: 3, window: 5_000 });

      // Record 2 failures at t=1_000_000
      await failN(breaker, 2);

      // Advance past the window so those failures decay
      vi.advanceTimersByTime(5_001);

      // Record 2 more failures — total in window is now 2 (the old 2 decayed)
      await failN(breaker, 2);

      expect(breaker.state).toBe("closed");

      // One more should open it (3 within window)
      await failN(breaker, 1);
      expect(breaker.state).toBe("open");
    });
  });

  describe("open state", () => {
    test("should throw CircuitOpenError when delay has not elapsed", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      const error = await breaker
        .execute(() => Promise.resolve("should not run"))
        .catch((e) => e);

      expect(error).toBeInstanceOf(CircuitOpenError);
    });

    test("should include debug info in CircuitOpenError", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      const error: CircuitOpenError = await breaker
        .execute(() => Promise.resolve("nope"))
        .catch((e) => e);

      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as any).debug).toMatchSnapshot();
    });

    test("should transition to half-open and execute probe after delay", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      const result = await breaker.execute(() => Promise.resolve("probed"));

      expect(result).toBe("probed");
      expect(breaker.state).toBe("closed");
    });

    test("should re-open and increment halfOpenAttempts on failed probe", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});

      expect(breaker.state).toBe("open");
    });

    test("should require exponentially longer delay for subsequent probes", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      // First probe after 1_000ms (baseDelay * 2^0 = 1_000)
      vi.advanceTimersByTime(1_000);
      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});
      expect(breaker.state).toBe("open");

      // Second probe needs 2_000ms (baseDelay * 2^1 = 2_000)
      vi.advanceTimersByTime(1_999);
      const tooEarly = await breaker
        .execute(() => Promise.resolve("nope"))
        .catch((e) => e);
      expect(tooEarly).toBeInstanceOf(CircuitOpenError);

      vi.advanceTimersByTime(1);
      const result = await breaker.execute(() => Promise.resolve("ok"));
      expect(result).toBe("ok");
      expect(breaker.state).toBe("closed");
    });

    test("should cap backoff at halfOpenMaxDelay", async () => {
      const breaker = makeBreaker({
        halfOpenDelay: 1_000,
        halfOpenBackoff: 2,
        halfOpenMaxDelay: 4_000,
      });

      await failN(breaker, 3);

      // Fail probes: attempt 0 (delay=1000), attempt 1 (delay=2000), attempt 2 (delay=4000)
      for (const delay of [1_000, 2_000, 4_000]) {
        vi.advanceTimersByTime(delay);
        await breaker.execute(() => Promise.reject(transientError)).catch(() => {});
      }

      // Attempt 3 should also be capped at 4_000 (not 8_000)
      vi.advanceTimersByTime(4_000);
      const result = await breaker.execute(() => Promise.resolve("capped"));
      expect(result).toBe("capped");
      expect(breaker.state).toBe("closed");
    });
  });

  describe("half-open / probe concurrency", () => {
    test("should share probe result — only one fn executes as the probe", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      const calls: string[] = [];

      let resolveProbe!: (v: string) => void;
      const probeFn = () =>
        new Promise<string>((r) => {
          calls.push("probe");
          resolveProbe = r;
        });

      const waiterFn = () => {
        calls.push("waiter");
        return Promise.resolve("waiter-result");
      };

      const p1 = breaker.execute(probeFn);
      const p2 = breaker.execute(waiterFn);

      // At this point, p1 started the probe. p2 should be waiting.
      expect(calls).toEqual(["probe"]);

      // Resolve the probe — circuit closes, waiter retries and executes
      resolveProbe("probe-result");

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe("probe-result");
      expect(r2).toBe("waiter-result");
      expect(calls).toEqual(["probe", "waiter"]);
      expect(breaker.state).toBe("closed");
    });

    test("should make waiters retry and get CircuitOpenError after probe failure", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      let rejectProbe!: (e: Error) => void;
      const probeFn = () =>
        new Promise<string>((_, rej) => {
          rejectProbe = rej;
        });

      const waiterFn = vi.fn(() => Promise.resolve("nope"));

      const p1 = breaker.execute(probeFn);
      const p2 = breaker.execute(waiterFn);

      rejectProbe(transientError);

      const [r1, r2] = await Promise.all([p1.catch((e) => e), p2.catch((e) => e)]);

      expect(r1).toBe(transientError);
      expect(r2).toBeInstanceOf(CircuitOpenError);
      expect(waiterFn).not.toHaveBeenCalled();
      expect(breaker.state).toBe("open");
    });

    test("should prevent race condition — two simultaneous calls, only one probes", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      const fn1 = vi.fn(() => Promise.resolve("r1"));
      const fn2 = vi.fn(() => Promise.resolve("r2"));

      const p1 = breaker.execute(fn1);
      const p2 = breaker.execute(fn2);

      const [r1, r2] = await Promise.all([p1, p2]);

      // One should be the probe, the other should wait and retry
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(r1).toBe("r1");
      expect(r2).toBe("r2");
      expect(breaker.state).toBe("closed");
    });
  });

  describe("events", () => {
    test("should emit events with correct data on transitions", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);

      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);
      await breaker.execute(() => Promise.resolve("ok"));

      expect(events).toMatchSnapshot();
    });

    test("should not emit when state does not change", () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);

      // Already closed — resetting should not fire
      breaker.reset();

      expect(events).toEqual([]);
    });
  });

  describe("open()", () => {
    test("should force transition from closed to open", () => {
      const breaker = makeBreaker();

      breaker.open();

      expect(breaker.state).toBe("open");
      expect(breaker.isOpen).toBe(true);
    });

    test("should force transition from half-open to open", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);
      vi.advanceTimersByTime(1_000);

      // Start a probe to enter half-open
      let resolveProbe!: (v: string) => void;
      const p1 = breaker.execute(
        () =>
          new Promise<string>((r) => {
            resolveProbe = r;
          }),
      );

      expect(breaker.state).toBe("half-open");

      breaker.open();
      expect(breaker.state).toBe("open");

      // Resolve the in-flight probe so it settles
      resolveProbe("done");
      await p1;
    });

    test("should be a no-op when already open", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);
      await failN(breaker, 3);

      events.length = 0;
      breaker.open();

      expect(events).toEqual([]);
    });

    test("should reset sliding window and halfOpenAttempts", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      // Fail a probe to increment halfOpenAttempts
      vi.advanceTimersByTime(1_000);
      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});

      breaker.reset();
      breaker.open();

      // After open(), backoff starts fresh — baseDelay should suffice
      vi.advanceTimersByTime(1_000);
      const result = await breaker.execute(() => Promise.resolve("fresh"));
      expect(result).toBe("fresh");
    });

    test("should emit open event", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);

      breaker.open();

      expect(events).toMatchSnapshot();
    });

    test("should set openedAt so backoff delay applies", async () => {
      const breaker = makeBreaker();

      breaker.open();

      // Immediately after open(), delay has not elapsed
      const error = await breaker.execute(() => Promise.resolve("nope")).catch((e) => e);

      expect(error).toBeInstanceOf(CircuitOpenError);

      // After delay, probe should work
      vi.advanceTimersByTime(1_000);
      const result = await breaker.execute(() => Promise.resolve("ok"));
      expect(result).toBe("ok");
    });
  });

  describe("close()", () => {
    test("should transition from open to half-open", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);
      expect(breaker.state).toBe("open");

      breaker.close();

      expect(breaker.state).toBe("half-open");
      expect(breaker.isHalfOpen).toBe(true);
    });

    test("should be a no-op when already closed", () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);

      breaker.close();

      expect(events).toEqual([]);
      expect(breaker.state).toBe("closed");
    });

    test("should be a no-op when already half-open", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);
      await failN(breaker, 3);
      vi.advanceTimersByTime(1_000);

      // Start probe to enter half-open
      let resolveProbe!: (v: string) => void;
      const p1 = breaker.execute(
        () =>
          new Promise<string>((r) => {
            resolveProbe = r;
          }),
      );
      expect(breaker.state).toBe("half-open");

      events.length = 0;

      breaker.close();
      expect(events).toEqual([]);
      expect(breaker.state).toBe("half-open");

      resolveProbe("done");
      await p1;
    });

    test("should allow next execute() to run as probe", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      breaker.close();

      const result = await breaker.execute(() => Promise.resolve("probed"));

      expect(result).toBe("probed");
      expect(breaker.state).toBe("closed");
    });

    test("should re-open if probe fails after close()", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      breaker.close();

      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});

      expect(breaker.state).toBe("open");
    });

    test("should reset halfOpenAttempts so backoff starts fresh", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      // Fail probes to escalate backoff: attempt 0 (1s), 1 (2s), 2 (4s)
      for (const delay of [1_000, 2_000, 4_000]) {
        vi.advanceTimersByTime(delay);
        await breaker.execute(() => Promise.reject(transientError)).catch(() => {});
      }
      // halfOpenAttempts is 3, next delay would be 8_000

      // close() resets — probe runs immediately from half-open (no delay)
      breaker.close();
      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});
      // halfOpenAttempts is now 1 (not 4), delay is 2_000 (not 8_000)

      vi.advanceTimersByTime(2_000);
      const result = await breaker.execute(() => Promise.resolve("ok"));
      expect(result).toBe("ok");
    });

    test("should emit half-open event", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);
      await failN(breaker, 3);
      events.length = 0;

      breaker.close();

      expect(events).toMatchSnapshot();
    });

    test("should handle concurrent execute() calls after close()", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      breaker.close();

      const calls: string[] = [];

      let resolveProbe!: (v: string) => void;
      const probeFn = () =>
        new Promise<string>((r) => {
          calls.push("probe");
          resolveProbe = r;
        });

      const waiterFn = () => {
        calls.push("waiter");
        return Promise.resolve("waiter-result");
      };

      const p1 = breaker.execute(probeFn);
      const p2 = breaker.execute(waiterFn);

      expect(calls).toEqual(["probe"]);

      resolveProbe("probe-result");

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe("probe-result");
      expect(r2).toBe("waiter-result");
      expect(breaker.state).toBe("closed");
    });

    test("should work in cycle: open() -> close() -> probe success -> closed", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);

      // Simulate driver disconnect
      breaker.open();
      expect(breaker.state).toBe("open");

      // Simulate driver reconnect
      breaker.close();
      expect(breaker.state).toBe("half-open");

      // Next call probes
      const result = await breaker.execute(() => Promise.resolve("recovered"));
      expect(result).toBe("recovered");
      expect(breaker.state).toBe("closed");

      expect(events.map((e) => `${e.from}->${e.to}`)).toMatchSnapshot();
    });

    test("should work in cycle: open() -> close() -> probe failure -> open", async () => {
      const breaker = makeBreaker();

      breaker.open();
      breaker.close();

      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});

      expect(breaker.state).toBe("open");
    });
  });

  describe("reset()", () => {
    test("should transition to closed state", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      expect(breaker.state).toBe("open");

      breaker.reset();

      expect(breaker.state).toBe("closed");
    });

    test("should clear accumulated failures", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 2);

      breaker.reset();

      // Need full threshold to open again (old failures are gone)
      await failN(breaker, 2);
      expect(breaker.state).toBe("closed");

      await failN(breaker, 1);
      expect(breaker.state).toBe("open");
    });

    test("should resolve pending probe promise (unblocks waiters)", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      let resolveProbe!: (v: string) => void;
      const probeFn = () =>
        new Promise<string>((r) => {
          resolveProbe = r;
        });

      const waiterFn = vi.fn(() => Promise.resolve("after-reset"));

      const p1 = breaker.execute(probeFn);
      const p2 = breaker.execute(waiterFn);

      // Reset while probe is in-flight
      breaker.reset();

      // Resolve the original probe so p1 settles
      resolveProbe("probe-done");

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe("probe-done");
      expect(r2).toBe("after-reset");
      expect(breaker.state).toBe("closed");
    });

    test("should reset halfOpenAttempts so backoff starts over", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      // First probe fails — halfOpenAttempts becomes 1
      vi.advanceTimersByTime(1_000);
      await breaker.execute(() => Promise.reject(transientError)).catch(() => {});

      breaker.reset();

      // Trigger open state again
      await failN(breaker, 3);

      // Should only need baseDelay (1_000), not 2_000 (which would be attempt 1 backoff)
      vi.advanceTimersByTime(1_000);
      const result = await breaker.execute(() => Promise.resolve("fresh"));
      expect(result).toBe("fresh");
    });
  });

  describe("configuration", () => {
    test("should use default classifier (all errors transient)", async () => {
      const breaker = new CircuitBreaker({ name: "defaults", threshold: 1 });

      await breaker.execute(() => Promise.reject(new Error("any"))).catch(() => {});

      expect(breaker.state).toBe("open");
    });

    test("should use custom classifier", async () => {
      const breaker = makeBreaker({ classifier: classifyByMessage });

      await breaker.execute(() => Promise.reject(ignorableError)).catch(() => {});
      expect(breaker.state).toBe("closed");

      await breaker.execute(() => Promise.reject(permanentError)).catch(() => {});
      expect(breaker.state).toBe("open");
    });

    test("should use default threshold of 5", async () => {
      const breaker = new CircuitBreaker({ name: "default-threshold" });

      await failN(breaker, 4);
      expect(breaker.state).toBe("closed");

      await failN(breaker, 1);
      expect(breaker.state).toBe("open");
    });

    test("should use custom threshold", async () => {
      const breaker = makeBreaker({ threshold: 10 });

      await failN(breaker, 9);
      expect(breaker.state).toBe("closed");

      await failN(breaker, 1);
      expect(breaker.state).toBe("open");
    });

    test("should use custom window duration", async () => {
      const breaker = makeBreaker({ threshold: 3, window: 2_000 });

      await failN(breaker, 2);

      vi.advanceTimersByTime(2_001);

      // Old failures decayed; need 3 fresh ones
      await failN(breaker, 2);
      expect(breaker.state).toBe("closed");

      await failN(breaker, 1);
      expect(breaker.state).toBe("open");
    });
  });

  describe("public getters", () => {
    test("should expose name", () => {
      const breaker = makeBreaker({ name: "my-service" });
      expect(breaker.name).toBe("my-service");
    });

    test("should expose boolean state helpers", async () => {
      const breaker = makeBreaker();

      expect(breaker.isClosed).toBe(true);
      expect(breaker.isOpen).toBe(false);
      expect(breaker.isHalfOpen).toBe(false);

      await failN(breaker, 3);

      expect(breaker.isClosed).toBe(false);
      expect(breaker.isOpen).toBe(true);
      expect(breaker.isHalfOpen).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("should handle fn that resolves synchronously", async () => {
      const breaker = makeBreaker();

      const result = await breaker.execute(() => Promise.resolve(42));

      expect(result).toBe(42);
    });

    test("should handle rapid transitions: closed -> open -> half-open -> closed", async () => {
      const breaker = makeBreaker();
      const events = collectEvents(breaker);

      // closed -> open
      await failN(breaker, 3);
      expect(breaker.state).toBe("open");

      // open -> half-open -> closed
      vi.advanceTimersByTime(1_000);
      await breaker.execute(() => Promise.resolve("ok"));
      expect(breaker.state).toBe("closed");

      expect(events.map((e) => `${e.from}->${e.to}`)).toMatchSnapshot();
    });

    test("should handle reset while probe is in-flight", async () => {
      const breaker = makeBreaker();
      await failN(breaker, 3);

      vi.advanceTimersByTime(1_000);

      let resolveProbe!: () => void;
      const probeFn = () =>
        new Promise<string>((r) => {
          resolveProbe = () => r("done");
        });

      const p1 = breaker.execute(probeFn);

      breaker.reset();
      expect(breaker.state).toBe("closed");

      resolveProbe();
      const result = await p1;
      expect(result).toBe("done");
    });
  });
});
