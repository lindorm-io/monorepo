import { join } from "path";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("@lindorm/proteus", async () => ({
  __esModule: true,
  writeSource: vi.fn().mockResolvedValue(undefined),
  writeEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lindorm/iris", () => ({
  __esModule: true,
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
} from "./drivers";

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

  test("runProteusInit delegates to proteus writeSource with loggerImport", async () => {
    await runProteusInit("/tmp/project", "postgres");

    expect(mockedProteusWriteSource).toHaveBeenCalledWith({
      driver: "postgres",
      directory: join("/tmp/project", "src/proteus"),
      loggerImport: "../logger",
    });
  });

  test("runProteusInit is a no-op for none", async () => {
    await runProteusInit("/tmp/project", "none");
    expect(mockedProteusWriteSource).not.toHaveBeenCalled();
  });

  test("runIrisInit delegates to iris writeSource with loggerImport", async () => {
    await runIrisInit("/tmp/project", "rabbit");

    expect(mockedIrisWriteSource).toHaveBeenCalledWith({
      driver: "rabbit",
      directory: join("/tmp/project", "src/iris"),
      loggerImport: "../logger",
    });
  });

  test("runIrisInit is a no-op for none", async () => {
    await runIrisInit("/tmp/project", "none");
    expect(mockedIrisWriteSource).not.toHaveBeenCalled();
  });

  test("runProteusGenerateSampleEntity writes SampleEntity", async () => {
    await runProteusGenerateSampleEntity("/tmp/project");

    expect(mockedProteusWriteEntity).toHaveBeenCalledWith({
      name: "SampleEntity",
      directory: join("/tmp/project", "src/proteus/entities"),
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
    await expect(runProteusInit("/tmp/project", "postgres")).rejects.toThrow("boom");
  });
});
