import { EventEmitter } from "events";
import { spawn } from "child_process";
import { composeDown } from "./compose-down.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("child_process");

const mockSpawn = spawn as MockedFunction<typeof spawn>;

const createMockChild = () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
};

describe("composeDown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should spawn with correct args", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeDown("/path/compose.yml", false);

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should omit -f when file is empty", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeDown("", false);

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should inherit stdio when verbose", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeDown("", true);

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should resolve even on non-zero exit code", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const promise = composeDown("", false);

    child.emit("close", 1);

    await expect(promise).resolves.toBeUndefined();

    writeSpy.mockRestore();
  });

  test("should resolve on spawn error", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeDown("", false);

    child.emit("error", new Error("spawn ENOENT"));

    await expect(promise).resolves.toBeUndefined();
  });

  test("should log warning on spawn error in verbose mode", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const promise = composeDown("", true);

    child.emit("error", new Error("spawn ENOENT"));

    await promise;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("spawn ENOENT"));

    warnSpy.mockRestore();
  });

  test("should log warning on non-zero exit in verbose mode", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const promise = composeDown("", true);

    child.emit("close", 1);

    await promise;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("exited with code 1"));

    warnSpy.mockRestore();
  });

  test("should not log warning on success in verbose mode", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const promise = composeDown("", true);

    child.emit("close", 0);

    await promise;

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test("should flush buffered stderr on non-zero exit in quiet mode", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const promise = composeDown("", false);

    child.stderr.emit("data", Buffer.from("volume in use\n"));
    child.emit("close", 1);

    await promise;

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const flushed = writeSpy.mock.calls[0]![0] as Buffer;
    expect(flushed.toString()).toBe("volume in use\n");

    writeSpy.mockRestore();
  });

  test("should not flush on successful exit in quiet mode", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const promise = composeDown("", false);

    child.stderr.emit("data", Buffer.from("removing container\n"));
    child.emit("close", 0);

    await promise;

    expect(writeSpy).not.toHaveBeenCalled();

    writeSpy.mockRestore();
  });
});
