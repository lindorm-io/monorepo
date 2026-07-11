import { join } from "path";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("@lindorm/proteus/scaffold", async () => ({
  writeSource: vi.fn().mockResolvedValue(undefined),
  writeEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lindorm/iris/scaffold", () => ({
  writeSource: vi.fn().mockResolvedValue(undefined),
  writeMessage: vi.fn().mockResolvedValue(undefined),
}));

import {
  writeEntity as proteusWriteEntity,
  writeSource as proteusWriteSource,
} from "@lindorm/proteus/scaffold";
import {
  writeMessage as irisWriteMessage,
  writeSource as irisWriteSource,
} from "@lindorm/iris/scaffold";
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

  test("db-only selection writes the primary to src/proteus/db", async () => {
    await runProteusInit("/tmp/project", { db: "postgres", kv: "none" });

    expect(mockedProteusWriteSource).toHaveBeenCalledTimes(1);
    expect(mockedProteusWriteSource).toHaveBeenCalledWith({
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus/db"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
  });

  test("kv-only selection writes the kv driver as the db-role primary", async () => {
    await runProteusInit("/tmp/project", { db: "none", kv: "redis" });

    expect(mockedProteusWriteSource).toHaveBeenCalledTimes(1);
    expect(mockedProteusWriteSource).toHaveBeenCalledWith({
      driver: "redis",
      directory: join("/tmp/project", "src/proteus/db"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
  });

  test("db + kv writes the db primary and the kv secondary (cache = kv)", async () => {
    await runProteusInit("/tmp/project", { db: "postgres", kv: "redis" });

    expect(mockedProteusWriteSource).toHaveBeenCalledTimes(2);
    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(1, {
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus/db"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: "redis",
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(2, {
      driver: "redis",
      directory: join("/tmp/project", "src/proteus/kv"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
  });

  test("DB primary gets a memory cache when kv is memory", async () => {
    await runProteusInit("/tmp/project", { db: "postgres", kv: "memory" });

    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(1, {
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus/db"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: "memory",
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(2, {
      driver: "memory",
      directory: join("/tmp/project", "src/proteus/kv"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
  });

  test("sqlite db + redis kv: sqlite is not a cacheable DB driver, so cache stays null", async () => {
    await runProteusInit("/tmp/project", { db: "sqlite", kv: "redis" });

    expect(mockedProteusWriteSource).toHaveBeenNthCalledWith(1, {
      driver: "sqlite",
      directory: join("/tmp/project", "src/proteus/db"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
  });

  test("runProteusInit is a no-op when both db and kv are none", async () => {
    await runProteusInit("/tmp/project", { db: "none", kv: "none" });
    expect(mockedProteusWriteSource).not.toHaveBeenCalled();
  });

  test("runIrisInit delegates to iris writeSource with loggerImport", async () => {
    await runIrisInit("/tmp/project", "rabbit");

    expect(mockedIrisWriteSource).toHaveBeenCalledWith({
      driver: "rabbit",
      directory: join("/tmp/project", "src/iris"),
      loggerImport: "../logger/index.js",
      configImport: "../pylon/config.js",
    });
  });

  test("runIrisInit is a no-op for none", async () => {
    await runIrisInit("/tmp/project", "none");
    expect(mockedIrisWriteSource).not.toHaveBeenCalled();
  });

  test("runProteusGenerateSampleEntity writes SampleEntity under src/proteus/db/entities", async () => {
    await runProteusGenerateSampleEntity("/tmp/project");

    expect(mockedProteusWriteEntity).toHaveBeenCalledWith({
      name: "SampleEntity",
      directory: join("/tmp/project", "src/proteus/db/entities"),
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
      runProteusInit("/tmp/project", { db: "postgres", kv: "none" }),
    ).rejects.toThrow("boom");
  });
});
