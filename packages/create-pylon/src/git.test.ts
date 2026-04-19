import { EventEmitter } from "events";

jest.mock("cross-spawn", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import spawn from "cross-spawn";
import { initGit, isInsideGitRepo } from "./git";

const mockedSpawn = spawn as unknown as jest.Mock;

const scheduleClose = (child: EventEmitter, code: number): void => {
  setImmediate(() => child.emit("close", code));
};

const queueChildren = (codes: Array<number>): Array<EventEmitter> => {
  const children: Array<EventEmitter> = [];
  codes.forEach((code) => {
    const child = new EventEmitter();
    children.push(child);
    mockedSpawn.mockImplementationOnce(() => {
      scheduleClose(child, code);
      return child;
    });
  });
  return children;
};

describe("initGit", () => {
  let stderr: jest.SpyInstance;
  let stdout: jest.SpyInstance;

  beforeEach(() => {
    mockedSpawn.mockReset();
    stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderr.mockRestore();
    stdout.mockRestore();
  });

  test("runs init, add, and commit in sequence when outside a git repo", async () => {
    // rev-parse fails (code 128) → not inside a repo
    queueChildren([128, 0, 0, 0]);

    await initGit("/tmp/project");

    const calls = mockedSpawn.mock.calls.map((c) => c[1]);
    expect(calls).toEqual([
      ["rev-parse", "--is-inside-work-tree"],
      ["init"],
      ["add", "."],
      ["commit", "-m", "chore: initial commit from create-pylon"],
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });

  test("skips init and commit when already inside a git repo", async () => {
    // rev-parse succeeds → inside a repo
    queueChildren([0]);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    expect(mockedSpawn.mock.calls[0][1]).toEqual(["rev-parse", "--is-inside-work-tree"]);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      "Detected existing git repository; skipping git init and initial commit.\n",
    );
  });

  test("swallows failure from git init and warns", async () => {
    queueChildren([128, 1]);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(2);
    expect(stderr).toHaveBeenCalled();
  });

  test("swallows failure from git add and stops", async () => {
    queueChildren([128, 0, 1]);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(3);
    expect(stderr).toHaveBeenCalled();
  });

  test("swallows failure from git commit and warns", async () => {
    queueChildren([128, 0, 0, 1]);

    await initGit("/tmp/project");

    expect(mockedSpawn).toHaveBeenCalledTimes(4);
    expect(stderr).toHaveBeenCalled();
  });
});

describe("isInsideGitRepo", () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
  });

  test("returns true when rev-parse exits 0", async () => {
    const child = new EventEmitter();
    mockedSpawn.mockImplementationOnce(() => {
      scheduleClose(child, 0);
      return child;
    });

    await expect(isInsideGitRepo("/tmp/project")).resolves.toBe(true);
  });

  test("returns false when rev-parse exits non-zero", async () => {
    const child = new EventEmitter();
    mockedSpawn.mockImplementationOnce(() => {
      scheduleClose(child, 128);
      return child;
    });

    await expect(isInsideGitRepo("/tmp/project")).resolves.toBe(false);
  });
});
