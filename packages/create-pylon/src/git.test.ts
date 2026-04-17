import { EventEmitter } from "events";

jest.mock("cross-spawn", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import spawn from "cross-spawn";
import { initGit } from "./git";

const mockedSpawn = spawn as unknown as jest.Mock;

const scheduleClose = (child: EventEmitter, code: number): void => {
  setImmediate(() => child.emit("close", code));
};

describe("initGit", () => {
  let stderr: jest.SpyInstance;

  beforeEach(() => {
    mockedSpawn.mockReset();
    stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderr.mockRestore();
  });

  test("runs init, add, and commit in sequence", async () => {
    const children: Array<EventEmitter> = [];
    mockedSpawn.mockImplementation(() => {
      const child = new EventEmitter();
      children.push(child);
      scheduleClose(child, 0);
      return child;
    });

    await initGit("/tmp/project");

    const calls = mockedSpawn.mock.calls.map((c) => c[1]);
    expect(calls).toEqual([
      ["init"],
      ["add", "."],
      ["commit", "-m", "chore: initial commit from create-pylon"],
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });

  test("swallows failure from git init and warns", async () => {
    const child = new EventEmitter();
    mockedSpawn.mockReturnValueOnce(child);
    scheduleClose(child, 1);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    expect(stderr).toHaveBeenCalled();
  });

  test("swallows failure from git add and stops", async () => {
    const first = new EventEmitter();
    const second = new EventEmitter();
    mockedSpawn.mockReturnValueOnce(first).mockReturnValueOnce(second);
    scheduleClose(first, 0);
    scheduleClose(second, 1);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(2);
    expect(stderr).toHaveBeenCalled();
  });

  test("swallows failure from git commit and warns", async () => {
    const a = new EventEmitter();
    const b = new EventEmitter();
    const c = new EventEmitter();
    mockedSpawn.mockReturnValueOnce(a).mockReturnValueOnce(b).mockReturnValueOnce(c);
    scheduleClose(a, 0);
    scheduleClose(b, 0);
    scheduleClose(c, 1);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(3);
    expect(stderr).toHaveBeenCalled();
  });
});
