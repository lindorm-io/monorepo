import { EventEmitter } from "events";
import { spawn } from "child_process";
import { spawnCommand } from "./spawn-command";
import { forwardSignals } from "./forward-signals";

jest.mock("child_process");
jest.mock("./forward-signals");

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockForwardSignals = forwardSignals as jest.MockedFunction<typeof forwardSignals>;
const mockUnforward = jest.fn();

const createMockChild = () => {
  const child = new EventEmitter();
  (child as any).kill = jest.fn();
  return child;
};

describe("spawnCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockForwardSignals.mockReturnValue(mockUnforward);
  });

  test("should spawn command with stdio inherit", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", ["--runInBand", "--no-coverage"]);

    expect(mockSpawn.mock.calls[0]).toMatchSnapshot();

    child.emit("close", 0, null);
    await promise;
  });

  test("should forward signals to child", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    expect(mockForwardSignals).toHaveBeenCalledWith(child);

    child.emit("close", 0, null);
    await promise;
  });

  test("should return exit code 0", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", 0, null);

    expect(await promise).toBe(0);
  });

  test("should return non-zero exit code", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", 1, null);

    expect(await promise).toBe(1);
  });

  test("should return 127 on spawn error", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("nonexistent", []);

    child.emit("error", new Error("spawn ENOENT"));

    expect(await promise).toBe(127);
  });

  test("should return 128 + signal number for SIGTERM", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", null, "SIGTERM");

    expect(await promise).toBe(143);
  });

  test("should return 128 + signal number for SIGINT", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", null, "SIGINT");

    expect(await promise).toBe(130);
  });

  test("should default to 128 + 15 for unknown signals", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", null, "SIGUSR1");

    expect(await promise).toBe(143);
  });

  test("should return 1 when code is null and no signal", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", null, null);

    expect(await promise).toBe(1);
  });

  test("should unforward signals on close", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("jest", []);

    child.emit("close", 0, null);
    await promise;

    expect(mockUnforward).toHaveBeenCalled();
  });

  test("should unforward signals on error", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = spawnCommand("nonexistent", []);

    child.emit("error", new Error("spawn ENOENT"));
    await promise;

    expect(mockUnforward).toHaveBeenCalled();
  });
});
