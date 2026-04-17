import { join } from "path";

jest.mock("@lindorm/proteus", () => ({
  __esModule: true,
  writeSource: jest.fn().mockResolvedValue(undefined),
  writeEntity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@lindorm/iris", () => ({
  __esModule: true,
  writeSource: jest.fn().mockResolvedValue(undefined),
  writeMessage: jest.fn().mockResolvedValue(undefined),
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
  runIrisGenerateMessage,
  runIrisInit,
  runProteusGenerateEntity,
  runProteusInit,
} from "./drivers";

const mockedProteusWriteSource = proteusWriteSource as jest.Mock;
const mockedProteusWriteEntity = proteusWriteEntity as jest.Mock;
const mockedIrisWriteSource = irisWriteSource as jest.Mock;
const mockedIrisWriteMessage = irisWriteMessage as jest.Mock;

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

  test("runProteusGenerateEntity forwards entity name", async () => {
    await runProteusGenerateEntity("/tmp/project", "SampleEntity");

    expect(mockedProteusWriteEntity).toHaveBeenCalledWith({
      name: "SampleEntity",
      directory: join("/tmp/project", "src/proteus/entities"),
    });
  });

  test("runIrisGenerateMessage forwards message name", async () => {
    await runIrisGenerateMessage("/tmp/project", "SampleMessage");

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
