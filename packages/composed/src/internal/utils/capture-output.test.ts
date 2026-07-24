import { EventEmitter } from "events";
import { spawn } from "child_process";
import { captureOutput } from "./capture-output.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("child_process");

const mockSpawn = spawn as MockedFunction<typeof spawn>;

const createMockChild = () => {
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
  child.stdout = new EventEmitter();
  return child;
};

describe("captureOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("spawns with piped stdout and ignored stdin/stderr", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = captureOutput("docker", ["ps"]);

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0);
    await promise;
  });

  test("resolves with captured stdout and exit code", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = captureOutput("docker", ["ps"]);

    child.stdout.emit("data", Buffer.from("first "));
    child.stdout.emit("data", Buffer.from("second"));
    child.emit("close", 0);

    await expect(promise).resolves.toEqual({ code: 0, stdout: "first second" });
  });

  test("resolves (never rejects) on a non-zero exit, preserving stdout", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = captureOutput("docker", ["compose", "config"]);

    child.stdout.emit("data", Buffer.from("partial"));
    child.emit("close", 2);

    await expect(promise).resolves.toEqual({ code: 2, stdout: "partial" });
  });

  test("treats a null exit code as 0", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = captureOutput("docker", ["ps"]);

    child.emit("close", null);

    await expect(promise).resolves.toEqual({ code: 0, stdout: "" });
  });

  test("rejects only when the binary cannot be spawned", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = captureOutput("docker", ["ps"]);

    child.emit("error", new Error("spawn ENOENT"));

    await expect(promise).rejects.toThrow("Failed to spawn docker: spawn ENOENT");
  });
});
