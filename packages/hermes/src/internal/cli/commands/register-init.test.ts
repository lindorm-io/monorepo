import { Command } from "commander";
import { registerInitCommand } from "./register-init";
import { init } from "./init";

jest.mock("./init", () => ({
  init: jest.fn(),
}));

const mockInit = init as jest.MockedFunction<typeof init>;

describe("registerInitCommand", () => {
  let program: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerInitCommand(program);
  });

  it("should register an 'init' command on the program", () => {
    const cmd = program.commands.find((c) => c.name() === "init");
    expect(cmd).toBeDefined();
  });

  it("should register 'i' as an alias", () => {
    const cmd = program.commands.find((c) => c.name() === "init")!;
    expect(cmd.alias()).toBe("i");
  });

  it("should register --directory option", () => {
    const cmd = program.commands.find((c) => c.name() === "init")!;
    const opt = cmd.options.find((o) => o.long === "--directory");
    expect(opt).toBeDefined();
    expect(opt!.short).toBe("-d");
  });

  it("should register --dry-run option", () => {
    const cmd = program.commands.find((c) => c.name() === "init")!;
    const opt = cmd.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  it("should wire init as the action", async () => {
    mockInit.mockResolvedValue(undefined);

    await program.parseAsync(["node", "hermes", "init"]);

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it("should pass --directory option through", async () => {
    mockInit.mockResolvedValue(undefined);

    await program.parseAsync(["node", "hermes", "init", "-d", "./custom"]);

    const [opts] = mockInit.mock.calls[0];
    expect((opts as any).directory).toBe("./custom");
  });
});
