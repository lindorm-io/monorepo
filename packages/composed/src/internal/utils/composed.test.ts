import type { ComposedOptions } from "../../types/index.js";
import { composeDown } from "./compose-down.js";
import { composeUp } from "./compose-up.js";
import { composed } from "./composed.js";
import { inspectServices } from "./inspect-services.js";
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
vi.mock("./inspect-services.js");

const mockResolveComposeFile = resolveComposeFile as MockedFunction<
  typeof resolveComposeFile
>;
const mockComposeUp = composeUp as MockedFunction<typeof composeUp>;
const mockComposeDown = composeDown as MockedFunction<typeof composeDown>;
const mockSpawnCommand = spawnCommand as MockedFunction<typeof spawnCommand>;
const mockInspectServices = inspectServices as MockedFunction<typeof inspectServices>;

const defaultOptions: ComposedOptions = {
  file: "docker-compose.yml",
  project: "",
  verbose: false,
  build: false,
  teardown: true,
  keepVolumes: false,
  reuse: false,
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

    expect(mockComposeDown).toHaveBeenCalledWith(
      "/resolved/docker-compose.yml",
      false,
      false,
      "",
    );
  });

  test("should forward keepVolumes to composeDown", async () => {
    await composed({ ...defaultOptions, keepVolumes: true });

    expect(mockComposeDown).toHaveBeenCalledWith(
      "/resolved/docker-compose.yml",
      false,
      true,
      "",
    );
  });

  test("should forward project to composeUp and composeDown", async () => {
    await composed({ ...defaultOptions, project: "tyr-test" });

    expect(mockComposeUp).toHaveBeenCalledWith(
      expect.objectContaining({ project: "tyr-test" }),
    );
    expect(mockComposeDown).toHaveBeenCalledWith(
      "/resolved/docker-compose.yml",
      false,
      false,
      "tyr-test",
    );
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

    expect(mockComposeDown).toHaveBeenCalledWith(
      "/resolved/docker-compose.yml",
      true,
      false,
      "",
    );
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

  describe("reuse", () => {
    const reuseOptions = { ...defaultOptions, reuse: true };

    test("does not inspect services when reuse is off", async () => {
      await composed(defaultOptions);

      expect(mockInspectServices).not.toHaveBeenCalled();
    });

    test("attaches (no up, no teardown) when all required ports are already served", async () => {
      mockInspectServices.mockResolvedValue({
        required: [5672, 6379],
        bound: new Map([
          [5672, "root-rabbitmq-1"],
          [6379, "root-redis-1"],
        ]),
        boundRequired: [5672, 6379],
        status: "all",
      });

      const result = await composed(reuseOptions);

      expect(result).toBe(0);
      expect(mockComposeUp).not.toHaveBeenCalled();
      expect(mockComposeDown).not.toHaveBeenCalled();
      expect(mockSpawnCommand).toHaveBeenCalled();
    });

    test("prints a reuse notice in quiet mode with the served ports", async () => {
      mockInspectServices.mockResolvedValue({
        required: [5672],
        bound: new Map([[5672, "root-rabbitmq-1"]]),
        boundRequired: [5672],
        status: "all",
      });

      await composed(reuseOptions);

      const written = stdoutSpy.mock.calls.map((args) => String(args[0]));
      expect(
        written.some((line) => line.startsWith("Reusing already-running services")),
      ).toBe(true);
      expect(written).not.toContain("Starting services...\n");
    });

    test("fails fast with a naming message on a partial port conflict", async () => {
      mockInspectServices.mockResolvedValue({
        required: [5672, 6379],
        bound: new Map([[5672, "root-rabbitmq-1"]]),
        boundRequired: [5672],
        status: "partial",
      });

      const result = await composed(reuseOptions);

      expect(result).toBe(1);
      expect(mockComposeUp).not.toHaveBeenCalled();
      expect(mockSpawnCommand).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("5672 (held by root-rabbitmq-1)"),
      );
    });

    test("starts and tears down normally when no ports are bound", async () => {
      mockInspectServices.mockResolvedValue({
        required: [5672],
        bound: new Map(),
        boundRequired: [],
        status: "none",
      });

      const result = await composed(reuseOptions);

      expect(result).toBe(0);
      expect(mockComposeUp).toHaveBeenCalled();
      expect(mockComposeDown).toHaveBeenCalled();
    });
  });
});
