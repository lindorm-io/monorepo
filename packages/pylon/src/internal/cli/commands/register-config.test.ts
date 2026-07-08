import { Command } from "commander";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { configInit } from "./config-init.js";
import { registerConfigCommand } from "./register-config.js";

vi.mock("./config-init.js", () => ({
  configInit: vi.fn(),
}));

const mockConfigInit = configInit as MockedFunction<typeof configInit>;

describe("registerConfigCommand", () => {
  let program: Command;
  let configCmd: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    configCmd = program.commands.find((c) => c.name() === "config")!;
  });

  it("registers a 'config' command on the program", () => {
    expect(configCmd).toBeDefined();
  });

  it("registers an 'init' subcommand", () => {
    const cmd = configCmd.commands.find((c) => c.name() === "init");
    expect(cmd).toBeDefined();
  });

  it("registers --dry-run option on init", () => {
    const cmd = configCmd.commands.find((c) => c.name() === "init")!;
    const opt = cmd.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  it("registers --force option on init", () => {
    const cmd = configCmd.commands.find((c) => c.name() === "init")!;
    const opt = cmd.options.find((o) => o.long === "--force");
    expect(opt).toBeDefined();
    expect(opt!.short).toBe("-f");
  });

  it("wires configInit as the action", async () => {
    mockConfigInit.mockResolvedValue(undefined);

    await program.parseAsync(["node", "pylon", "config", "init"]);

    expect(mockConfigInit).toHaveBeenCalledTimes(1);
  });

  it("passes --force through to configInit", async () => {
    mockConfigInit.mockResolvedValue(undefined);

    await program.parseAsync(["node", "pylon", "config", "init", "--force"]);

    expect(mockConfigInit).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
      expect.anything(),
    );
  });
});
