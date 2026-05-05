import { join } from "path";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("@lindorm/proteus", async () => ({
  writeSource: vi.fn().mockResolvedValue(undefined),
  writeEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lindorm/iris", () => ({
  writeSource: vi.fn().mockResolvedValue(undefined),
  writeMessage: vi.fn().mockResolvedValue(undefined),
}));

import {
  writeEntity as proteusWriteEntity,
  writeSource as proteusWriteSource,
} from "@lindorm/proteus";
import {
  writeMessage as irisWriteMessage,
  writeSource as irisWriteSource,
} from "@lindorm/iris";
import {
  runIrisGenerateSampleMessage,
  runIrisInit,
  runProteusGenerateSampleEntity,
  runProteusInit,
} from "./drivers.js";

const mockedProteusWriteSource = proteusWriteSource as Mock;
const mockedProteusWriteEntity = proteusWriteEntity as Mock;
const mockedIrisWriteSource = irisWriteSource as Mock;
const mockedIrisWriteMessage = irisWriteMessage as Mock;

describe("drivers", () => {
  beforeEach(() => {
    mockedProteusWriteSource.mockClear();
    mockedProteusWriteEntity.mockClear();
    mockedIrisWriteSource.mockClear();
    mockedIrisWriteMessage.mockClear();
  });

  test("single-driver selection writes to flat src/proteus directory", async () => {
    await runProteusInit("/tmp/project", { proteusDrivers: ["postgres"] });

    expect(mockedProteusWriteSource).toHaveBeenCalledTimes(1);
    expect(mockedProteusWriteSource).toHaveBeenCalledWith({
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus"),
      loggerImport: "../logger/index.js",
      configImport: "../pylon/config.js",
      amphoraImport: "../pylon/amphora.js",
      cache: null,
    });
  });

  test("multi-driver selection writes to nested per-driver directories", async () => {
    await runProteusInit("/tmp/project", {
      proteusDrivers: ["postgres", "redis", "mongo"],
    });

    expect(mockedProteusWriteSource).toHaveBeenCalledTimes(3);
    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(1, {
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus/postgres"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: "redis",
    });
    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(2, {
      driver: "redis",
      directory: join("/tmp/project", "src/proteus/redis"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
    });
    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(3, {
      driver: "mongo",
      directory: join("/tmp/project", "src/proteus/mongo"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: "redis",
    });
  });

  test("DB driver gets memory cache when memory is selected but redis is not", async () => {
    await runProteusInit("/tmp/project", {
      proteusDrivers: ["postgres", "memory"],
    });

    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(1, {
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus/postgres"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: "memory",
    });
  });

  test("redis wins over memory for cache when both are selected", async () => {
    await runProteusInit("/tmp/project", {
      proteusDrivers: ["mongo", "redis", "memory"],
    });

    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(1, {
      driver: "mongo",
      directory: join("/tmp/project", "src/proteus/mongo"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: "redis",
    });
  });

  test("runProteusInit is a no-op for empty drivers", async () => {
    await runProteusInit("/tmp/project", { proteusDrivers: [] });
    expect(mockedProteusWriteSource).not.toHaveBeenCalled();
  });

  test("runIrisInit delegates to iris writeSource with loggerImport", async () => {
    await runIrisInit("/tmp/project", "rabbit");

    expect(mockedIrisWriteSource).toHaveBeenCalledWith({
      driver: "rabbit",
      directory: join("/tmp/project", "src/iris"),
      loggerImport: "../logger/index.js",
    });
  });

  test("runIrisInit is a no-op for none", async () => {
    await runIrisInit("/tmp/project", "none");
    expect(mockedIrisWriteSource).not.toHaveBeenCalled();
  });

  test("runProteusGenerateSampleEntity writes SampleEntity in flat layout by default", async () => {
    await runProteusGenerateSampleEntity("/tmp/project");

    expect(mockedProteusWriteEntity).toHaveBeenCalledWith({
      name: "SampleEntity",
      directory: join("/tmp/project", "src/proteus/entities"),
    });
  });

  test("runProteusGenerateSampleEntity targets driver subdirectory when given", async () => {
    await runProteusGenerateSampleEntity("/tmp/project", "postgres");

    expect(mockedProteusWriteEntity).toHaveBeenCalledWith({
      name: "SampleEntity",
      directory: join("/tmp/project", "src/proteus/postgres/entities"),
    });
  });

  test("runIrisGenerateSampleMessage writes SampleMessage", async () => {
    await runIrisGenerateSampleMessage("/tmp/project");

    expect(mockedIrisWriteMessage).toHaveBeenCalledWith({
      name: "SampleMessage",
      directory: join("/tmp/project", "src/iris/messages"),
    });
  });

  test("propagates errors from proteus writeSource", async () => {
    mockedProteusWriteSource.mockRejectedValueOnce(new Error("boom"));
    await expect(
      runProteusInit("/tmp/project", { proteusDrivers: ["postgres"] }),
    ).rejects.toThrow("boom");
  });
});
