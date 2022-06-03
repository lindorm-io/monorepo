import { IntervalWorker } from "./IntervalWorker";
import { sleep } from "@lindorm-io/core";
import { createMockLogger } from "@lindorm-io/winston";

describe("IntervalWorker.ts", () => {
  let eventResult: any;
  let worker: IntervalWorker;
  let callback: any;

  const logger = createMockLogger();

  beforeEach(() => {
    eventResult = {};
    callback = jest.fn(
      () =>
        new Promise((resolve) => {
          resolve("mock-success");
        }),
    );

    worker = new IntervalWorker({
      logger,
      callback,
      time: 5,
    });
    worker.on(IntervalWorker.Event.START, () => {
      eventResult.start = true;
    });
    worker.on(IntervalWorker.Event.STOP, () => {
      eventResult.stop = true;
    });
    worker.on(IntervalWorker.Event.SUCCESS, () => {
      eventResult.success = true;
      worker.stop();
    });
    worker.on(IntervalWorker.Event.ERROR, () => {
      eventResult.error = true;
      worker.stop();
    });
  });

  test("should run callback", async () => {
    worker.trigger();
    await sleep(10);
    worker.stop();

    expect(callback).toHaveBeenCalled();
    expect(eventResult).toStrictEqual({
      success: true,
      stop: true,
    });
  });

  test("should start and eventually run callback", async () => {
    worker.start();
    await sleep(10);
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
