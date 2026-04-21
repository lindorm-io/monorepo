import type { ComposedOptions } from "../../types";
import { composeDown } from "./compose-down";
import { composeUp } from "./compose-up";
import { composed } from "./composed";
import { resolveComposeFile } from "./resolve-compose-file";
import { spawnCommand } from "./spawn-command";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("./resolve-compose-file");
vi.mock("./compose-up");
vi.mock("./compose-down");
vi.mock("./spawn-command");

const mockResolveComposeFile = resolveComposeFile as MockedFunction<
  typeof resolveComposeFile
>;
const mockComposeUp = composeUp as MockedFunction<typeof composeUp>;
const mockComposeDown = composeDown as MockedFunction<typeof composeDown>;
const mockSpawnCommand = spawnCommand as MockedFunction<typeof spawnCommand>;

const defaultOptions: ComposedOptions = {
  file: "docker-compose.yml",
  verbose: false,
  build: false,
  teardown: true,
  waitTimeout: 60,
  command: "jest",
  commandArgs: ["--runInBand"],
};

describe("composed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveComposeFile.mockReturnValue("/resolved/docker-compose.yml");
    mockComposeUp.mockResolvedValue(undefined);
    mockComposeDown.mockResolvedValue(undefined);
    mockSpawnCommand.mockResolvedValue(0);
  });

  test("should resolve compose file path", async () => {
    await composed(defaultOptions);

    expect(mockResolveComposeFile).toHaveBeenCalledWith("docker-compose.yml");
  });

  test("should call composeUp with resolved file", async () => {
    await composed(defaultOptions);

    expect(mockComposeUp).toHaveBeenCalledWith(
      expect.objectContaining({ file: "/resolved/docker-compose.yml" }),
    );
  });

  test("should call composeUp before spawnCommand", async () => {
    const callOrder: Array<string> = [];
    mockComposeUp.mockImplementation(async () => {
      callOrder.push("up");
    });
    mockSpawnCommand.mockImplementation(async () => {
      callOrder.push("spawn");
      return 0;
    });

    await composed(defaultOptions);

    expect(callOrder).toEqual(["up", "spawn"]);
  });

  test("should call composeDown after spawnCommand", async () => {
    await composed(defaultOptions);

    expect(mockComposeDown).toHaveBeenCalledWith("/resolved/docker-compose.yml", false);
  });

  test("should return exit code from spawnCommand", async () => {
    mockSpawnCommand.mockResolvedValue(42);

    const result = await composed(defaultOptions);

    expect(result).toBe(42);
  });

  test("should skip composeDown when teardown is false", async () => {
    await composed({ ...defaultOptions, teardown: false });

    expect(mockComposeDown).not.toHaveBeenCalled();
  });

  test("should return 1 and teardown on composeUp failure", async () => {
    mockComposeUp.mockRejectedValue(new Error("up failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation();

    const result = await composed(defaultOptions);

    expect(result).toBe(1);
    expect(mockComposeDown).toHaveBeenCalled();
    expect(mockSpawnCommand).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  test("should log error message on composeUp failure", async () => {
    mockComposeUp.mockRejectedValue(new Error("up failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation();

    await composed(defaultOptions);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("up failed"));

    errorSpy.mockRestore();
  });

  test("should not teardown on composeUp failure when teardown is false", async () => {
    mockComposeUp.mockRejectedValue(new Error("up failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation();

    await composed({ ...defaultOptions, teardown: false });

    expect(mockComposeDown).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  test("should call composeDown even when spawnCommand rejects", async () => {
    mockSpawnCommand.mockRejectedValue(new Error("spawn error"));

    const result = await composed(defaultOptions);

    expect(result).toBe(127);
    expect(mockComposeDown).toHaveBeenCalled();
  });

  test("should pass verbose flag to composeDown", async () => {
    await composed({ ...defaultOptions, verbose: true });

    expect(mockComposeDown).toHaveBeenCalledWith("/resolved/docker-compose.yml", true);
  });
});
