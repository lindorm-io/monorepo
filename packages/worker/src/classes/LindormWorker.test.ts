import { createMockLogger } from "@lindorm/logger";
import { WorkerCallback } from "../types";
import { LindormWorker } from "./LindormWorker";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("LindormWorker", () => {
  let callback: jest.MockedFunction<WorkerCallback>;
  let worker: LindormWorker;

  beforeEach(() => {
    callback = jest.fn().mockResolvedValue("OK");

    worker = new LindormWorker({
      alias: "Alias",
      callback,
      interval: 40,
      logger: createMockLogger(),
    });
  });

  afterEach(() => {
    worker.stop();
  });

  const wait = (times: number) =>
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (callback.mock.calls.length === times) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 25);
    });

  test("should execute callback when starting", async () => {
    worker.start();

    expect(worker.running).toEqual(true);

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

  test("should execute callback multiple times", async () => {
    worker.start();

    expect(worker.running).toEqual(true);

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

  test("should only execute callback once when starting multiple times", async () => {
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
});
