import { EventEmitter } from "events";
import { spawn } from "child_process";
import { composeUp } from "./compose-up";
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

describe("composeUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should spawn with correct args", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeUp({
      file: "/path/compose.yml",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should include --build flag", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeUp({
      file: "/path/compose.yml",
      verbose: false,
      build: true,
      waitTimeout: 60,
    });

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should use custom wait timeout", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeUp({
      file: "/path/compose.yml",
      verbose: false,
      build: false,
      waitTimeout: 120,
    });

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should omit -f when file is empty", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeUp({
      file: "",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should inherit stdio when verbose", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeUp({
      file: "",
      verbose: true,
      build: false,
      waitTimeout: 60,
    });

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("should reject on non-zero exit code", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const promise = composeUp({
      file: "",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    child.emit("close", 1);

    await expect(promise).rejects.toThrow("docker compose up exited with code 1");

    writeSpy.mockRestore();
  });

  test("should reject on spawn error", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = composeUp({
      file: "",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    child.emit("error", new Error("spawn ENOENT"));

    await expect(promise).rejects.toThrow("Failed to spawn docker: spawn ENOENT");
  });

  test("should flush buffered stderr on non-zero exit in quiet mode", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const promise = composeUp({
      file: "",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    child.stderr.emit("data", Buffer.from("network not found\n"));
    child.stdout.emit("data", Buffer.from("container create failed\n"));
    child.emit("close", 1);

    await expect(promise).rejects.toThrow();

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const flushed = writeSpy.mock.calls[0]![0] as Buffer;
    expect(flushed.toString()).toBe("network not found\ncontainer create failed\n");

    writeSpy.mockRestore();
  });

  test("should not flush anything on successful exit", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const promise = composeUp({
      file: "",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    child.stderr.emit("data", Buffer.from("pulling image\n"));
    child.emit("close", 0);

    await promise;

    expect(writeSpy).not.toHaveBeenCalled();

    writeSpy.mockRestore();
  });
});
