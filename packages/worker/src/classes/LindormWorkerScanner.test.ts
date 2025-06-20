import { RetryStrategy } from "@lindorm/retry";
import { join } from "path";
import { LindormWorkerEvent } from "../enums";
import { LindormWorkerConfig } from "../types";
import { LindormWorkerScanner } from "./LindormWorkerScanner";

const workerConfig: LindormWorkerConfig = {
  alias: "CustomWorker",
  callback: async () => {},
  interval: 1000,
  listeners: [{ event: LindormWorkerEvent.Start, listener: () => {} }],
  randomize: 100,
  retry: {
    maxAttempts: 10,
    strategy: RetryStrategy.Exponential,
    timeout: 1000,
    timeoutMax: 10000,
  },
};

describe("LindormWorkerScanner", () => {
  test("should return with array of worker config", () => {
    expect(LindormWorkerScanner.scan([workerConfig])).toEqual([workerConfig]);
  });

  test("should return with array of worker config", () => {
    expect(
      LindormWorkerScanner.scan([join(__dirname, "..", "__fixtures__", "workers")]),
    ).toMatchSnapshot();
  });
});
