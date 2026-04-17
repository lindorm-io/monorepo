import { createMockLogger } from "@lindorm/logger";
import { join } from "path";
import { LindormWorkerScannerError } from "../errors";
import { ILindormWorker } from "../interfaces";
import { LindormWorkerConfig } from "../types";
import { LindormWorker } from "./LindormWorker";
import { LindormWorkerScanner } from "./LindormWorkerScanner";

const workerConfig: LindormWorkerConfig = {
  alias: "CustomWorker",
  callback: async () => {},
  interval: 1000,
  listeners: [{ event: "start", listener: () => {} }],
  jitter: 100,
  retry: {
    maxAttempts: 10,
    strategy: "exponential",
    timeout: 1000,
    timeoutMax: 10000,
  },
};

describe("LindormWorkerScanner", () => {
  test("should return with array of worker config", () => {
    expect(LindormWorkerScanner.scan([workerConfig])).toEqual([workerConfig]);
  });

  test("should return with array of worker config from directory", () => {
    expect(
      LindormWorkerScanner.scan([join(__dirname, "..", "__fixtures__", "workers")]),
    ).toMatchSnapshot();
  });

  test("should pass an ILindormWorker instance through untouched", () => {
    const instance: ILindormWorker = new LindormWorker({
      alias: "PassThrough",
      callback: async () => {},
      interval: 1000,
      logger: createMockLogger(),
    });

    const result = LindormWorkerScanner.scan([instance]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(instance);
  });

  test("should pick up default-exported LindormWorker instance from file", () => {
    const result = LindormWorkerScanner.scan([
      join(__dirname, "..", "__fixtures__", "workers-default-instance"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(LindormWorker);
    expect((result[0] as ILindormWorker).alias).toBe("DefaultInstance");
  });

  test("should pick up named-exported LindormWorker instance from file", () => {
    const result = LindormWorkerScanner.scan([
      join(__dirname, "..", "__fixtures__", "workers-named-instance"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(LindormWorker);
    expect((result[0] as ILindormWorker).alias).toBe("NamedInstance");
  });

  test("should throw when file has neither LindormWorker instance nor CALLBACK", () => {
    expect(() =>
      LindormWorkerScanner.scan([
        join(__dirname, "..", "__fixtures__", "workers-invalid"),
      ]),
    ).toThrow(LindormWorkerScannerError);
  });

  test("should handle mixed directory with instance, CALLBACK and denied file", () => {
    const result = LindormWorkerScanner.scan([
      join(__dirname, "..", "__fixtures__", "workers-mixed"),
    ]);

    expect(result).toHaveLength(2);

    const aliases = result.map((item) =>
      item instanceof LindormWorker ? item.alias : item.alias,
    );

    expect(aliases).toEqual(expect.arrayContaining(["CallbackWorker", "MixedInstance"]));
  });

  test("should handle mixed inputs of instance, config and string path", () => {
    const instance: ILindormWorker = new LindormWorker({
      alias: "MixedInputInstance",
      callback: async () => {},
      interval: 1000,
      logger: createMockLogger(),
    });

    const result = LindormWorkerScanner.scan([
      instance,
      workerConfig,
      join(__dirname, "..", "__fixtures__", "workers-default-instance"),
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(instance);
    expect(result[1]).toBe(workerConfig);
    expect(result[2]).toBeInstanceOf(LindormWorker);
    expect((result[2] as ILindormWorker).alias).toBe("DefaultInstance");
  });
});
