import { Command } from "commander";
import { registerGenerateCommands } from "./register-generate";
import { generateEntity } from "./generate-entity";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("./generate-entity", async () => ({
  generateEntity: vi.fn(),
}));

const mockGenerateEntity = generateEntity as MockedFunction<typeof generateEntity>;

describe("registerGenerateCommands", () => {
  let program: Command;
  let generateCmd: Command;
  let entityCmd: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerGenerateCommands(program);
    generateCmd = program.commands.find((c) => c.name() === "generate")!;
    entityCmd = generateCmd.commands.find((c) => c.name() === "entity")!;
  });

  it("should register a 'generate' command on the program", () => {
    expect(generateCmd).toBeDefined();
  });

  it("should register 'g' as alias for generate", () => {
    expect(generateCmd.alias()).toBe("g");
  });

  it("should register an 'entity' subcommand under generate", () => {
    expect(entityCmd).toBeDefined();
  });

  it("should register 'e' as alias for entity", () => {
    expect(entityCmd.alias()).toBe("e");
  });

  it("should register --directory option on entity", () => {
    const opt = entityCmd.options.find((o) => o.long === "--directory");
    expect(opt).toBeDefined();
    expect(opt!.short).toBe("-d");
  });

  it("should register --dry-run option on entity", () => {
    const opt = entityCmd.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  it("should wire generateEntity as the action", async () => {
    mockGenerateEntity.mockResolvedValue(undefined);

    await program.parseAsync(["node", "proteus", "generate", "entity", "User"]);

    expect(mockGenerateEntity).toHaveBeenCalledTimes(1);
  });

  it("should pass name argument through", async () => {
    mockGenerateEntity.mockResolvedValue(undefined);

    await program.parseAsync(["node", "proteus", "generate", "entity", "UserProfile"]);

    const [name] = mockGenerateEntity.mock.calls[0];
    expect(name).toBe("UserProfile");
  });

  it("should pass --directory option through", async () => {
    mockGenerateEntity.mockResolvedValue(undefined);

    await program.parseAsync([
      "node",
      "proteus",
      "generate",
      "entity",
      "User",
      "-d",
      "./custom",
    ]);

    const [, opts] = mockGenerateEntity.mock.calls[0];
    expect((opts as any).directory).toBe("./custom");
  });

  it("should work with aliases", async () => {
    mockGenerateEntity.mockResolvedValue(undefined);

    await program.parseAsync(["node", "proteus", "g", "e", "User"]);

    expect(mockGenerateEntity).toHaveBeenCalledTimes(1);
    expect(mockGenerateEntity.mock.calls[0][0]).toBe("User");
  });
});
