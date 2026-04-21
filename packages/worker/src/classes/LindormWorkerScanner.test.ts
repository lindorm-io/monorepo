import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { join } from "path";
import { LindormWorkerScannerError } from "../errors";
import { ILindormWorker } from "../interfaces";
import { LindormWorker } from "./LindormWorker";
import { LindormWorkerScanner } from "./LindormWorkerScanner";
import { describe, expect, test } from "vitest";

describe("LindormWorkerScanner", () => {
  const logger = createMockLogger();

  test("should construct workers from a directory of CALLBACK files", async () => {
    const result = await LindormWorkerScanner.scan(
      [join(__dirname, "..", "__fixtures__", "workers")],
      logger,
    );

    expect(result).toHaveLength(3);
    expect(result.every((r) => r instanceof LindormWorker)).toBe(true);
    expect(result.map((r) => r.alias)).toMatchSnapshot();
  });

  test("should pass an ILindormWorker instance through untouched", async () => {
    const instance: ILindormWorker = new LindormWorker({
      alias: "PassThrough",
      callback: async () => {},
      interval: 1000,
      logger,
    });

    const result = await LindormWorkerScanner.scan([instance], logger);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(instance);
  });

  test("should pick up default-exported LindormWorker instance from file", async () => {
    const result = await LindormWorkerScanner.scan(
      [join(__dirname, "..", "__fixtures__", "workers-default-instance")],
      logger,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(LindormWorker);
    expect(result[0].alias).toBe("DefaultInstance");
  });

  test("should pick up named-exported LindormWorker instance from file", async () => {
    const result = await LindormWorkerScanner.scan(
      [join(__dirname, "..", "__fixtures__", "workers-named-instance")],
      logger,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(LindormWorker);
    expect(result[0].alias).toBe("NamedInstance");
  });

  test("should throw when file has neither LindormWorker instance nor CALLBACK", async () => {
    await expect(
      LindormWorkerScanner.scan(
        [join(__dirname, "..", "__fixtures__", "workers-invalid")],
        logger,
      ),
    ).rejects.toThrow(LindormWorkerScannerError);
  });

  test("should handle mixed directory with instance, CALLBACK and denied file", async () => {
    const result = await LindormWorkerScanner.scan(
      [join(__dirname, "..", "__fixtures__", "workers-mixed")],
      logger,
    );

    expect(result).toHaveLength(2);
    expect(result.every((r) => r instanceof LindormWorker)).toBe(true);

    const aliases = result.map((item) => item.alias);

    expect(aliases).toEqual(expect.arrayContaining(["CallbackWorker", "MixedInstance"]));
  });

  test("should handle mixed inputs of instance and string path", async () => {
    const instance: ILindormWorker = new LindormWorker({
      alias: "MixedInputInstance",
      callback: async () => {},
      interval: 1000,
      logger,
    });

    const result = await LindormWorkerScanner.scan(
      [instance, join(__dirname, "..", "__fixtures__", "workers-default-instance")],
      logger,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(instance);
    expect(result[1]).toBeInstanceOf(LindormWorker);
    expect(result[1].alias).toBe("DefaultInstance");
  });
});
