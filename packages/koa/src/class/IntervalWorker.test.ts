import { IntervalWorker } from "./IntervalWorker";
import { createMockLogger } from "@lindorm-io/core-logger";

describe("IntervalWorker.ts", () => {
  let eventResult: any;
  let worker: IntervalWorker;
  let callback: any;

  const waitUntil = (times: number) =>
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (worker.triggerAmount >= times) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 100);
    });

  beforeEach(() => {
    eventResult = {};
    callback = jest.fn(() => new Promise((resolve) => resolve("ok")));

    worker = new IntervalWorker(
      {
        callback,
        retry: { maximumAttempts: 0 },
        time: 2,
      },
      createMockLogger(),
    );
    worker.on(IntervalWorker.Event.START, () => {
      eventResult.start = true;
    });
    worker.on(IntervalWorker.Event.STOP, () => {
      eventResult.stop = true;
    });
    worker.on(IntervalWorker.Event.SUCCESS, () => {
      eventResult.success = true;
    });
    worker.on(IntervalWorker.Event.ERROR, () => {
      eventResult.error = true;
    });
  });

  test("should run callback", async () => {
    worker.trigger();

    expect(worker.isActive).toBe(true);

    await waitUntil(1);
    worker.stop();

    expect(callback).toHaveBeenCalled();
    expect(eventResult).toStrictEqual({
      success: true,
      stop: true,
    });
    expect(worker.isActive).toBe(false);
  });

  test("should run callback once", async () => {
    worker.trigger();
    worker.trigger();
    worker.trigger();
    await waitUntil(1);
    worker.stop();

    expect(callback).toHaveBeenCalled();
    expect(eventResult).toStrictEqual({
      success: true,
      stop: true,
    });
  });

  test("should start and eventually run callback", async () => {
    worker.start();
    await waitUntil(1);
    worker.stop();

    expect(callback).toHaveBeenCalled();
    expect(eventResult).toStrictEqual({
      start: true,
      stop: true,
      success: true,
    });
  });

  test("should not have run callback", async () => {
    worker.start();
    worker.stop();

    expect(callback).not.toHaveBeenCalled();
  });
});
