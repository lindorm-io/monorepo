import { Command } from "commander";
import { registerGenerateCommands } from "./register-generate";
import { generateDto } from "./generate-dto";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("./generate-dto", async () => ({
  generateDto: vi.fn(() => vi.fn()),
}));

const mockGenerateDto = generateDto as MockedFunction<typeof generateDto>;

describe("registerGenerateCommands", () => {
  let program: Command;
  let generateCmd: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateDto.mockReturnValue(vi.fn().mockResolvedValue(undefined));
    program = new Command();
    program.exitOverride();
    registerGenerateCommands(program);
    generateCmd = program.commands.find((c) => c.name() === "generate")!;
  });

  it("should register a 'generate' command on the program", () => {
    expect(generateCmd).toBeDefined();
  });

  it("should register 'g' as alias for generate", () => {
    expect(generateCmd.alias()).toBe("g");
  });

  it("should register 'command' subcommand with alias 'c'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "command")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("c");
  });

  it("should register 'query' subcommand with alias 'q'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "query")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("q");
  });

  it("should register 'event' subcommand with alias 'e'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "event")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("e");
  });

  it("should register 'timeout' subcommand with alias 't'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "timeout")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("t");
  });

  it("should register 'aggregate' subcommand with alias 'a'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "aggregate")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("a");
  });

  it("should register 'saga' subcommand with alias 's'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "saga")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("s");
  });

  it("should register 'view' subcommand with alias 'v'", () => {
    const cmd = generateCmd.commands.find((c) => c.name() === "view")!;
    expect(cmd).toBeDefined();
    expect(cmd.alias()).toBe("v");
  });

  it("should call generateDto with 'command' for command subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("command");
  });

  it("should call generateDto with 'query' for query subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("query");
  });

  it("should call generateDto with 'event' for event subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("event");
  });

  it("should call generateDto with 'timeout' for timeout subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("timeout");
  });

  it("should call generateDto with 'aggregate' for aggregate subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("aggregate");
  });

  it("should call generateDto with 'saga' for saga subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("saga");
  });

  it("should call generateDto with 'view' for view subcommand", () => {
    expect(mockGenerateDto).toHaveBeenCalledWith("view");
  });

  it("should register --directory and --dry-run on all subcommands", () => {
    for (const name of [
      "command",
      "query",
      "event",
      "timeout",
      "aggregate",
      "saga",
      "view",
    ]) {
      const cmd = generateCmd.commands.find((c) => c.name() === name)!;
      expect(cmd.options.find((o) => o.long === "--directory")).toBeDefined();
      expect(cmd.options.find((o) => o.long === "--dry-run")).toBeDefined();
    }
  });

  it("should work with aliases", async () => {
    const handler = mockGenerateDto.mock.results[0].value;

    await program.parseAsync(["node", "hermes", "g", "c", "CreateOrder"]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      "CreateOrder",
      expect.any(Object),
      expect.any(Object),
    );
  });
});
