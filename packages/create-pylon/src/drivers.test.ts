import { EventEmitter } from "events";
import { join } from "path";

jest.mock("cross-spawn", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import spawn from "cross-spawn";
import {
  runIrisGenerateMessage,
  runIrisInit,
  runProteusGenerateEntity,
  runProteusInit,
} from "./drivers";

const mockedSpawn = spawn as unknown as jest.Mock;

const createChild = (code: number): EventEmitter => {
  const child = new EventEmitter();
  setImmediate(() => child.emit("close", code));
  return child;
};

describe("drivers", () => {
  beforeEach(() => mockedSpawn.mockReset());

  test("runProteusInit uses ./node_modules/.bin/proteus", async () => {
    mockedSpawn.mockReturnValue(createChild(0));

    await runProteusInit("/tmp/project", "postgres");

    expect(mockedSpawn).toHaveBeenCalledWith(
      join("/tmp/project", "node_modules", ".bin", "proteus"),
      ["init", "--driver", "postgres", "-d", "./src/proteus"],
      { cwd: "/tmp/project", stdio: "inherit" },
    );
  });

  test("runProteusInit is a no-op for none", async () => {
    await runProteusInit("/tmp/project", "none");
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  test("runIrisInit uses ./node_modules/.bin/iris", async () => {
    mockedSpawn.mockReturnValue(createChild(0));

    await runIrisInit("/tmp/project", "rabbit");

    expect(mockedSpawn).toHaveBeenCalledWith(
      join("/tmp/project", "node_modules", ".bin", "iris"),
      ["init", "--driver", "rabbit", "-d", "./src/iris"],
      { cwd: "/tmp/project", stdio: "inherit" },
    );
  });

  test("runIrisInit is a no-op for none", async () => {
    await runIrisInit("/tmp/project", "none");
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  test("runProteusGenerateEntity forwards entity name", async () => {
    mockedSpawn.mockReturnValue(createChild(0));

    await runProteusGenerateEntity("/tmp/project", "SampleEntity");

    expect(mockedSpawn).toHaveBeenCalledWith(
      join("/tmp/project", "node_modules", ".bin", "proteus"),
      ["generate", "entity", "SampleEntity", "-d", "./src/proteus/entities"],
      { cwd: "/tmp/project", stdio: "inherit" },
    );
  });

  test("runIrisGenerateMessage forwards message name", async () => {
    mockedSpawn.mockReturnValue(createChild(0));

    await runIrisGenerateMessage("/tmp/project", "SampleMessage");

    expect(mockedSpawn).toHaveBeenCalledWith(
      join("/tmp/project", "node_modules", ".bin", "iris"),
      ["generate", "message", "SampleMessage", "-d", "./src/iris/messages"],
      { cwd: "/tmp/project", stdio: "inherit" },
    );
  });

  test("rejects on non-zero exit", async () => {
    mockedSpawn.mockReturnValue(createChild(1));
    await expect(runProteusInit("/tmp/project", "postgres")).rejects.toThrow(
      /exited with code 1/,
    );
  });
});
