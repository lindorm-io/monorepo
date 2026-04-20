import { createMockAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger";
import { ILindormWorker, LindormWorker } from "@lindorm/worker";
import { join } from "path";
import { scanWorkers } from "./scan-workers";

describe("scanWorkers", () => {
  const logger = createMockLogger();

  test("should return amphora worker plus instance plus scanned directory workers", async () => {
    const amphora = createMockAmphora();

    const worker: ILindormWorker = new LindormWorker({
      alias: "WorkerAlias",
      callback: async () => {},
      interval: "2m",
      logger,
    });

    await expect(
      scanWorkers({
        amphora,
        logger,
        workers: [worker, join(__dirname, "..", "..", "__fixtures__", "workers")],
      }),
    ).resolves.toEqual([
      expect.objectContaining({ alias: "AmphoraWorker" }),
      expect.objectContaining({ alias: "WorkerAlias" }),
      expect.objectContaining({ alias: "WorkerOne" }),
      expect.objectContaining({ alias: "WorkerThree" }),
      expect.objectContaining({ alias: "WorkerTwo" }),
    ]);
  });

  test("should pass an ILindormWorker instance through by reference without re-wrapping", async () => {
    const amphora = createMockAmphora();

    const worker: ILindormWorker = new LindormWorker({
      alias: "PassThroughWorker",
      callback: async () => {},
      interval: "2m",
      logger,
    });

    const result = await scanWorkers({ amphora, logger, workers: [worker] });

    expect(result).toHaveLength(2);
    expect(result[1]).toBe(worker);
  });

  test("should pass through instance exports from scanned directories", async () => {
    const amphora = createMockAmphora();

    const result = await scanWorkers({
      amphora,
      logger,
      workers: [join(__dirname, "..", "..", "__fixtures__", "workers-default-instance")],
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toBeInstanceOf(LindormWorker);
    expect(result[1].alias).toBe("DefaultInstance");
  });

  test("should accept a bare directory path string and scan it", async () => {
    const amphora = createMockAmphora();

    await expect(
      scanWorkers({
        amphora,
        logger,
        workers: join(__dirname, "..", "..", "__fixtures__", "workers"),
      }),
    ).resolves.toEqual([
      expect.objectContaining({ alias: "AmphoraWorker" }),
      expect.objectContaining({ alias: "WorkerOne" }),
      expect.objectContaining({ alias: "WorkerThree" }),
      expect.objectContaining({ alias: "WorkerTwo" }),
    ]);
  });

  test("should accept a bare ILindormWorker instance and pass it through by reference", async () => {
    const amphora = createMockAmphora();

    const worker: ILindormWorker = new LindormWorker({
      alias: "BareInstanceWorker",
      callback: async () => {},
      interval: "2m",
      logger,
    });

    const result = await scanWorkers({ amphora, logger, workers: worker });

    expect(result).toHaveLength(2);
    expect(result[1]).toBe(worker);
  });

  test("should handle mixed inputs of instance and directory path", async () => {
    const amphora = createMockAmphora();

    const worker: ILindormWorker = new LindormWorker({
      alias: "MixedWorker",
      callback: async () => {},
      interval: "2m",
      logger,
    });

    const result = await scanWorkers({
      amphora,
      logger,
      workers: [worker, join(__dirname, "..", "..", "__fixtures__", "workers")],
    });

    expect(result).toEqual([
      expect.objectContaining({ alias: "AmphoraWorker" }),
      expect.objectContaining({ alias: "MixedWorker" }),
      expect.objectContaining({ alias: "WorkerOne" }),
      expect.objectContaining({ alias: "WorkerThree" }),
      expect.objectContaining({ alias: "WorkerTwo" }),
    ]);

    expect(result[1]).toBe(worker);
  });
});
