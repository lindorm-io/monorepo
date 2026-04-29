import type { ComposedOptions } from "../../types/index.js";
import { composeDown } from "./compose-down.js";
import { composeUp } from "./compose-up.js";
import { composed } from "./composed.js";
import { resolveComposeFile } from "./resolve-compose-file.js";
import { spawnCommand } from "./spawn-command.js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockedFunction,
  type MockInstance,
} from "vitest";

vi.mock("./resolve-compose-file.js");
vi.mock("./compose-up.js");
vi.mock("./compose-down.js");
vi.mock("./spawn-command.js");

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
  let stdoutSpy: MockInstance<typeof process.stdout.write>;
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveComposeFile.mockReturnValue("/resolved/docker-compose.yml");
    mockComposeUp.mockResolvedValue(undefined);
    mockComposeDown.mockResolvedValue(undefined);
    mockSpawnCommand.mockResolvedValue(0);

    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
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

    const result = await composed(defaultOptions);

    expect(result).toBe(1);
    expect(mockComposeDown).toHaveBeenCalled();
    expect(mockSpawnCommand).not.toHaveBeenCalled();
  });

  test("should log error message on composeUp failure", async () => {
    mockComposeUp.mockRejectedValue(new Error("up failed"));

    await composed(defaultOptions);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("up failed"));
  });

  test("should not teardown on composeUp failure when teardown is false", async () => {
    mockComposeUp.mockRejectedValue(new Error("up failed"));

    await composed({ ...defaultOptions, teardown: false });

    expect(mockComposeDown).not.toHaveBeenCalled();
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

  test("should print status lines in quiet mode", async () => {
    await composed(defaultOptions);

    const written = stdoutSpy.mock.calls.map((args) => String(args[0]));
    expect(written).toContain("Starting services...\n");
    expect(written.some((line) => /^Services ready \(\d+\.\d+s\)\n$/.test(line))).toBe(
      true,
    );
    expect(written).toContain("Tearing down services...\n");
    expect(written.some((line) => /^Teardown complete \(\d+\.\d+s\)\n$/.test(line))).toBe(
      true,
    );
  });

  test("should not print status lines in verbose mode", async () => {
    await composed({ ...defaultOptions, verbose: true });

    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test("should skip teardown status lines when teardown is false", async () => {
    await composed({ ...defaultOptions, teardown: false });

    const written = stdoutSpy.mock.calls.map((args) => String(args[0]));
    expect(written.some((line) => line.startsWith("Tearing down"))).toBe(false);
    expect(written.some((line) => line.startsWith("Teardown complete"))).toBe(false);
  });
});
