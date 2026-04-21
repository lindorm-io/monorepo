import { EventEmitter } from "events";
import { spawn } from "child_process";
import { composeUp } from "./compose-up";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("child_process");

const mockSpawn = spawn as MockedFunction<typeof spawn>;
const createMockChild = () => new EventEmitter();

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

    const promise = composeUp({
      file: "",
      verbose: false,
      build: false,
      waitTimeout: 60,
    });

    child.emit("close", 1);

    await expect(promise).rejects.toThrow("docker compose up exited with code 1");
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
});
