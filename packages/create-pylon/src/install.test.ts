import { EventEmitter } from "events";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";

vi.mock("cross-spawn", async () => ({
  __esModule: true,
  default: vi.fn(),
}));

import spawn from "cross-spawn";
import { installDependencies, installDevDependencies } from "./install.js";

const mockedSpawn = spawn as unknown as Mock;

const createChild = (): EventEmitter => new EventEmitter();

const emitClose = (child: EventEmitter, code: number): void => {
  setImmediate(() => child.emit("close", code));
};

const emitError = (child: EventEmitter, error: Error): void => {
  setImmediate(() => child.emit("error", error));
};

let stdoutSpy: MockInstance;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
});

afterEach(() => stdoutSpy.mockRestore());

describe("installDependencies", () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
  });

  test("echoes the exact npm command before running", async () => {
    const child = createChild();
    mockedSpawn.mockReturnValue(child);
    emitClose(child, 0);

    await installDependencies("/tmp/project", ["foo", "bar"]);

    const printed = stdoutSpy.mock.calls.map(([s]) => String(s)).join("");
    expect(printed).toContain("npm install --save foo bar");
  });

  test("invokes npm install --save with packages", async () => {
    const child = createChild();
    mockedSpawn.mockReturnValue(child);
    emitClose(child, 0);

    await installDependencies("/tmp/project", ["foo", "bar"]);

    expect(mockedSpawn).toHaveBeenCalledWith("npm", ["install", "--save", "foo", "bar"], {
      cwd: "/tmp/project",
      stdio: "inherit",
    });
  });

  test("no-op when packages empty", async () => {
    await installDependencies("/tmp/project", []);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  test("rejects when npm exits non-zero", async () => {
    const child = createChild();
    mockedSpawn.mockReturnValue(child);
    emitClose(child, 1);

    await expect(installDependencies("/tmp/project", ["foo"])).rejects.toThrow(
      /exited with code 1/,
    );
  });

  test("rejects on spawn error", async () => {
    const child = createChild();
    mockedSpawn.mockReturnValue(child);
    emitError(child, new Error("boom"));

    await expect(installDependencies("/tmp/project", ["foo"])).rejects.toThrow("boom");
  });
});

describe("installDevDependencies", () => {
  beforeEach(() => mockedSpawn.mockReset());

  test("invokes npm install --save-dev with packages", async () => {
    const child = createChild();
    mockedSpawn.mockReturnValue(child);
    emitClose(child, 0);

    await installDevDependencies("/tmp/project", ["typescript"]);

    expect(mockedSpawn).toHaveBeenCalledWith(
      "npm",
      ["install", "--save-dev", "typescript"],
      { cwd: "/tmp/project", stdio: "inherit" },
    );
  });

  test("no-op when packages empty", async () => {
    await installDevDependencies("/tmp/project", []);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  test("echoes the exact npm command before running", async () => {
    const child = createChild();
    mockedSpawn.mockReturnValue(child);
    emitClose(child, 0);

    await installDevDependencies("/tmp/project", ["tsx", "typescript"]);

    const printed = stdoutSpy.mock.calls.map(([s]) => String(s)).join("");
    expect(printed).toContain("npm install --save-dev tsx typescript");
  });
});
