import { createMockAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger";
import { ILindormWorker, LindormWorker, LindormWorkerConfig } from "@lindorm/worker";
import { join } from "path";
import { scanWorkers } from "./scan-workers";

describe("scanWorkers", () => {
  const logger = createMockLogger();

  test("should return an array of workers", () => {
    const amphora = createMockAmphora();

    const config: LindormWorkerConfig = {
      alias: "config-alias",
      callback: async () => {},
      interval: "1m",
      retry: {},
    };

    const worker: ILindormWorker = new LindormWorker({
      alias: "WorkerAlias",
      callback: async () => {},
      interval: "2m",
      logger,
    });

    expect(
      scanWorkers({
        amphora,
        logger,
        workers: [config, worker, join(__dirname, "..", "..", "__fixtures__", "workers")],
      }),
    ).toEqual([
      expect.objectContaining({ alias: "AmphoraWorker" }),
      expect.objectContaining({ alias: "WorkerAlias" }),
      expect.objectContaining({ alias: "ConfigAlias" }),
      expect.objectContaining({ alias: "WorkerOne" }),
      expect.objectContaining({ alias: "WorkerThree" }),
      expect.objectContaining({ alias: "WorkerTwo" }),
    ]);
  });
});
