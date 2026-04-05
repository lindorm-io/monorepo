import { Command } from "commander";
import { registerGenerateCommands } from "./register-generate";
import { generateMessage } from "./generate-message";

jest.mock("./generate-message", () => ({
  generateMessage: jest.fn(),
}));

const mockGenerateMessage = generateMessage as jest.MockedFunction<
  typeof generateMessage
>;

describe("registerGenerateCommands", () => {
  let program: Command;
  let generateCmd: Command;
  let messageCmd: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerGenerateCommands(program);
    generateCmd = program.commands.find((c) => c.name() === "generate")!;
    messageCmd = generateCmd.commands.find((c) => c.name() === "message")!;
  });

  it("should register a 'generate' command on the program", () => {
    expect(generateCmd).toBeDefined();
  });

  it("should register 'g' as alias for generate", () => {
    expect(generateCmd.alias()).toBe("g");
  });

  it("should register a 'message' subcommand under generate", () => {
    expect(messageCmd).toBeDefined();
  });

  it("should register 'm' as alias for message", () => {
    expect(messageCmd.alias()).toBe("m");
  });

  it("should register --directory option on message", () => {
    const opt = messageCmd.options.find((o) => o.long === "--directory");
    expect(opt).toBeDefined();
    expect(opt!.short).toBe("-d");
  });

  it("should register --dry-run option on message", () => {
    const opt = messageCmd.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  it("should wire generateMessage as the action", async () => {
    mockGenerateMessage.mockResolvedValue(undefined);

    await program.parseAsync(["node", "iris", "generate", "message", "OrderCreated"]);

    expect(mockGenerateMessage).toHaveBeenCalledTimes(1);
  });

  it("should pass name argument through", async () => {
    mockGenerateMessage.mockResolvedValue(undefined);

    await program.parseAsync(["node", "iris", "generate", "message", "OrderCreated"]);

    const [name] = mockGenerateMessage.mock.calls[0];
    expect(name).toBe("OrderCreated");
  });

  it("should pass --directory option through", async () => {
    mockGenerateMessage.mockResolvedValue(undefined);

    await program.parseAsync([
      "node",
      "iris",
      "generate",
      "message",
      "OrderCreated",
      "-d",
      "./custom",
    ]);

    const [, opts] = mockGenerateMessage.mock.calls[0];
    expect((opts as any).directory).toBe("./custom");
  });

  it("should work with aliases", async () => {
    mockGenerateMessage.mockResolvedValue(undefined);

    await program.parseAsync(["node", "iris", "g", "m", "OrderCreated"]);

    expect(mockGenerateMessage).toHaveBeenCalledTimes(1);
    expect(mockGenerateMessage.mock.calls[0][0]).toBe("OrderCreated");
  });
});
