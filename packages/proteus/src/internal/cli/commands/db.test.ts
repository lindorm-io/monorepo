import { Command } from "commander";
import { registerDbCommands } from "./db.js";
import { dbPing } from "./db-ping.js";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("./db-ping.js", async () => ({
  dbPing: vi.fn(),
}));

const mockDbPing = dbPing as MockedFunction<typeof dbPing>;

describe("registerDbCommands", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride(); // Prevent commander from calling process.exit
    registerDbCommands(program);
  });

  it("should register a 'db' subcommand on the program", () => {
    const dbCommand = program.commands.find((c) => c.name() === "db");
    expect(dbCommand).toBeDefined();
  });

  it("should set the description for the 'db' command", () => {
    const dbCommand = program.commands.find((c) => c.name() === "db")!;
    expect(dbCommand.description()).toBe("Database diagnostic commands");
  });

  it("should register a 'ping' subcommand under 'db'", () => {
    const dbCommand = program.commands.find((c) => c.name() === "db")!;
    const pingCommand = dbCommand.commands.find((c) => c.name() === "ping");
    expect(pingCommand).toBeDefined();
  });

  it("should set the description for the 'ping' command", () => {
    const dbCommand = program.commands.find((c) => c.name() === "db")!;
    const pingCommand = dbCommand.commands.find((c) => c.name() === "ping")!;
    expect(pingCommand.description()).toBe("Verify database connectivity");
  });

  it("should register --source option on 'ping' command", () => {
    const dbCommand = program.commands.find((c) => c.name() === "db")!;
    const pingCommand = dbCommand.commands.find((c) => c.name() === "ping")!;
    const sourceOption = pingCommand.options.find((o) => o.long === "--source");
    expect(sourceOption).toBeDefined();
  });

  it("should wire dbPing as the action for the 'ping' command", async () => {
    mockDbPing.mockResolvedValue(undefined);

    await program.parseAsync(["node", "proteus", "db", "ping"]);

    expect(mockDbPing).toHaveBeenCalledTimes(1);
  });

  it("should pass --source option through to dbPing", async () => {
    mockDbPing.mockResolvedValue(undefined);

    await program.parseAsync([
      "node",
      "proteus",
      "db",
      "ping",
      "--source",
      "/path/config.ts",
    ]);

    const [opts] = mockDbPing.mock.calls[0];
    expect((opts as any).source).toBe("/path/config.ts");
  });
});
