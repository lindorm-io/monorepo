import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { sleep } from "@lindorm/utils";
import { LindormWorkerError } from "../errors/index.js";
import type {
  LindormWorkerCallback,
  LindormWorkerErrorCallback,
} from "../types/index.js";
import { LindormWorker } from "./LindormWorker.js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockedFunction,
} from "vitest";

describe("LindormWorker", () => {
  let callback: MockedFunction<LindormWorkerCallback>;
  let errorCallback: MockedFunction<LindormWorkerErrorCallback>;
  let listener: MockedFunction<() => void>;
  let worker: LindormWorker;

  beforeEach(() => {
    callback = vi.fn().mockResolvedValue(undefined);
    errorCallback = vi.fn().mockResolvedValue(undefined);
    listener = vi.fn();

    worker = new LindormWorker({
      alias: "Alias",
      callback,
      errorCallback,
      interval: 40,
      listeners: [{ event: "error", listener }],
      logger: createMockLogger(),
      retry: {
        maxAttempts: 5,
        strategy: "linear",
        timeout: 25,
        timeoutMax: 5000,
      },
    });
  });

  afterEach(async () => {
    if (!worker["_destroyed"]) {
      await worker.stop();
    }
  });

  const wait = (times: number, cb: any = callback) =>
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (cb.mock.calls.length === times) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 25);
    });

  test("should trigger callback", async () => {
    await expect(worker.trigger()).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("should run callback when starting", async () => {
    worker.start();

    expect(worker.running).toEqual(true);
    expect(worker.started).toEqual(true);
    expect(worker.latestStart).toEqual(expect.any(Date));

    await wait(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      logger: expect.any(Object),
      latestError: null,
      latestSuccess: null,
      latestTry: expect.any(Date),
      seq: 1,
    });
    expect(worker.seq).toEqual(1);
  });

  test("should run callback multiple times", async () => {
    worker.start();

    expect(worker.running).toEqual(true);
    expect(worker.started).toEqual(true);

    await wait(2);

    expect(callback).toHaveBeenCalledTimes(2);

    expect(callback).toHaveBeenNthCalledWith(1, {
      logger: expect.any(Object),
      latestError: null,
      latestSuccess: null,
      latestTry: expect.any(Date),
      seq: 1,
    });

    expect(callback).toHaveBeenNthCalledWith(2, {
      logger: expect.any(Object),
      latestError: null,
      latestSuccess: expect.any(Date),
      latestTry: expect.any(Date),
      seq: 2,
    });

    expect(worker.latestSuccess).toEqual(expect.any(Date));
    expect(worker.latestTry).toEqual(expect.any(Date));
    expect(worker.seq).toEqual(2);
  });

  test("should only run callback once when starting multiple times", async () => {
    worker.start();
    worker.start();
    worker.start();

    await wait(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(worker.seq).toEqual(1);
  });

  test("should stop worker", async () => {
    worker.start();

    expect(worker.running).toEqual(true);

    await wait(1);

    await worker.stop();

    expect(worker.running).toEqual(false);

    await sleep(50);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(worker.seq).toEqual(1);
  });

  test("should call error callback on error", async () => {
    callback.mockRejectedValue(new Error("Test Error"));

    await expect(worker.trigger()).resolves.toBeUndefined();

    expect(errorCallback).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(LindormWorkerError),
    );
  });

  test("should call listener on error", async () => {
    callback.mockRejectedValue(new Error("Test Error"));

    await expect(worker.trigger()).resolves.toBeUndefined();

    await wait(1, listener);

    expect(listener).toHaveBeenCalledWith(expect.any(LindormWorkerError));
  });

  describe("graceful shutdown", () => {
    test("should wait for running callback to complete before stop resolves", async () => {
      let callbackResolve: () => void;
      const slowCallback = new Promise<void>((resolve) => {
        callbackResolve = resolve;
      });
      callback.mockReturnValueOnce(slowCallback);

      worker.start();

      await sleep(10);

      expect(worker.running).toEqual(true);

      const stopPromise = worker.stop();

      expect(worker.running).toEqual(true);

      callbackResolve!();

      await stopPromise;

      expect(worker.running).toEqual(false);
    });

    test("should set running to false after stop resolves", async () => {
      worker.start();

      await wait(1);

      await worker.stop();

      expect(worker.running).toEqual(false);
      expect(worker.started).toEqual(false);
    });
  });

  describe("destroy", () => {
    test("should stop the worker", async () => {
      worker.start();

      await wait(1);

      await worker.destroy();

      expect(worker.running).toEqual(false);
      expect(worker.started).toEqual(false);
    });

    test("should throw on start after destroy", async () => {
      await worker.destroy();

      expect(() => worker.start()).toThrow(
        expect.objectContaining({ message: "Worker has been destroyed" }),
      );
    });

    test("should throw on trigger after destroy", async () => {
      await worker.destroy();

      await expect(worker.trigger()).rejects.toThrow(
        expect.objectContaining({ message: "Worker has been destroyed" }),
      );
    });

    test("should throw on on after destroy", async () => {
      await worker.destroy();

      expect(() => worker.on("start", vi.fn())).toThrow(
        expect.objectContaining({ message: "Worker has been destroyed" }),
      );
    });

    test("should throw on off after destroy", async () => {
      await worker.destroy();

      expect(() => worker.off("start", vi.fn())).toThrow(
        expect.objectContaining({ message: "Worker has been destroyed" }),
      );
    });

    test("should throw on once after destroy", async () => {
      await worker.destroy();

      expect(() => worker.once("start", vi.fn())).toThrow(
        expect.objectContaining({ message: "Worker has been destroyed" }),
      );
    });
  });

  describe("callback timeout", () => {
    test("should abort slow callback when timeout is exceeded", async () => {
      let callbackResolve: () => void;
      const slowCallback = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            callbackResolve = resolve;
          }),
      );

      const slowWorker = new LindormWorker({
        alias: "SlowWorker",
        callback: slowCallback,
        errorCallback,
        callbackTimeout: 50,
        interval: 1000,
        listeners: [{ event: "error", listener: vi.fn() }],
        logger: createMockLogger(),
        retry: { maxAttempts: 0 },
      });

      await slowWorker.trigger();

      expect(errorCallback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ message: "Callback timed out" }),
      );

      callbackResolve!();
      await slowWorker.stop();
    });

    test("should succeed normally when callback completes before timeout", async () => {
      const successListener = vi.fn();

      const fastWorker = new LindormWorker({
        alias: "FastWorker",
        callback: vi.fn().mockResolvedValue(undefined),
        callbackTimeout: 500,
        interval: 1000,
        listeners: [{ event: "success", listener: successListener }],
        logger: createMockLogger(),
      });

      await fastWorker.trigger();

      expect(successListener).toHaveBeenCalledTimes(1);

      await fastWorker.stop();
    });
  });

  describe("input validation", () => {
    test("should throw on interval of zero", () => {
      expect(
        () =>
          new LindormWorker({
            alias: "Test",
            callback,
            interval: 0,
            logger: createMockLogger(),
          }),
      ).toThrow(
        expect.objectContaining({ message: "Interval must be a positive number" }),
      );
    });

    test("should throw on negative interval", () => {
      expect(
        () =>
          new LindormWorker({
            alias: "Test",
            callback,
            interval: -100,
            logger: createMockLogger(),
          }),
      ).toThrow(
        expect.objectContaining({ message: "Interval must be a positive number" }),
      );
    });

    test("should throw on negative jitter", () => {
      expect(
        () =>
          new LindormWorker({
            alias: "Test",
            callback,
            interval: 100,
            jitter: -1,
            logger: createMockLogger(),
          }),
      ).toThrow(
        expect.objectContaining({ message: "Jitter must be a non-negative number" }),
      );
    });

    test("should throw on negative callbackTimeout", () => {
      expect(
        () =>
          new LindormWorker({
            alias: "Test",
            callback,
            interval: 100,
            callbackTimeout: -1,
            logger: createMockLogger(),
          }),
      ).toThrow(
        expect.objectContaining({
          message: "Callback timeout must be a non-negative number",
        }),
      );
    });
  });

  describe("off", () => {
    test("should remove listener so it is not called", async () => {
      const startListener = vi.fn();

      worker.on("start", startListener);
      worker.off("start", startListener);

      worker.start();

      expect(startListener).not.toHaveBeenCalled();
    });
  });

  describe("once", () => {
    test("should fire listener only on the first event", async () => {
      const successListener = vi.fn();

      worker.once("success", successListener);

      worker.start();

      await wait(2);

      expect(successListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("health", () => {
    test("should return health snapshot for idle worker", () => {
      expect(worker.health()).toMatchSnapshot();
    });

    test("should return health snapshot for started worker", async () => {
      worker.start();

      await wait(1);

      const health = worker.health();

      expect(health.alias).toEqual("Alias");
      expect(health.started).toEqual(true);
      expect(health.running).toEqual(false);
      expect(health.destroyed).toEqual(false);
      expect(health.seq).toEqual(1);
      expect(health.latestSuccess).toEqual(expect.any(Date));
      expect(health.latestError).toBeNull();
      expect(health.latestTry).toEqual(expect.any(Date));
    });
  });

  describe("warning events on retry", () => {
    test("should emit warning events during retries before max attempts", async () => {
      const warningListener = vi.fn();

      const retryWorker = new LindormWorker({
        alias: "RetryWorker",
        callback: vi.fn().mockRejectedValue(new Error("retry me")),
        errorCallback,
        interval: 1000,
        listeners: [
          { event: "warning", listener: warningListener },
          { event: "error", listener: vi.fn() },
        ],
        logger: createMockLogger(),
        retry: {
          maxAttempts: 3,
          strategy: "linear",
          timeout: 10,
          timeoutMax: 50,
        },
      });

      await retryWorker.trigger();

      expect(warningListener).toHaveBeenCalledTimes(3);
      expect(warningListener).toHaveBeenCalledWith(expect.any(LindormWorkerError));

      await retryWorker.stop();
    });
  });
});
