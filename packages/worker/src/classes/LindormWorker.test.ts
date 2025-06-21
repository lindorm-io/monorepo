import { LindormError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { RetryStrategy } from "@lindorm/retry";
import { LindormWorkerEvent } from "../enums";
import { LindormWorkerCallback, LindormWorkerErrorCallback } from "../types";
import { LindormWorker } from "./LindormWorker";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("LindormWorker", () => {
  let callback: jest.MockedFunction<LindormWorkerCallback>;
  let errorCallback: jest.MockedFunction<LindormWorkerErrorCallback>;
  let listener: jest.MockedFunction<() => void>;
  let worker: LindormWorker;

  beforeEach(() => {
    callback = jest.fn().mockResolvedValue(undefined);
    errorCallback = jest.fn().mockResolvedValue(undefined);
    listener = jest.fn();

    worker = new LindormWorker({
      alias: "Alias",
      callback,
      errorCallback,
      interval: 40,
      listeners: [{ event: LindormWorkerEvent.Error, listener }],
      logger: createMockLogger(),
      retry: {
        maxAttempts: 5,
        strategy: RetryStrategy.Linear,
        timeout: 25,
        timeoutMax: 5000,
      },
    });
  });

  afterEach(() => {
    worker.stop();
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

    worker.stop();

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
      expect.any(LindormError),
    );
  });

  test("should call listener on error", async () => {
    callback.mockRejectedValue(new Error("Test Error"));

    await expect(worker.trigger()).resolves.toBeUndefined();

    await wait(1, listener);

    expect(listener).toHaveBeenCalledWith(expect.any(LindormError));
  });
});
