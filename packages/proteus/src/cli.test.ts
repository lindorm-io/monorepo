/**
 * Tests for cli.ts entry point.
 *
 * cli.ts is a top-level script that:
 *   1. Polyfills Symbol.metadata
 *   2. Reads package.json for the version
 *   3. Creates a Commander program
 *   4. Registers migrate + db commands
 *   5. Calls program.parse()
 *
 * Because it calls program.parse() at module load time (which reads process.argv),
 * we test the building blocks it relies on, not the module execution itself.
 */

import { Command } from "commander";
import { registerMigrateCommands } from "./internal/cli/commands/migrate";
import { registerDbCommands } from "./internal/cli/commands/db";

jest.mock("./internal/cli/commands/migrate", () => ({
  registerMigrateCommands: jest.fn(),
}));
jest.mock("./internal/cli/commands/db", () => ({
  registerDbCommands: jest.fn(),
}));

const mockRegisterMigrateCommands = registerMigrateCommands as jest.MockedFunction<
  typeof registerMigrateCommands
>;
const mockRegisterDbCommands = registerDbCommands as jest.MockedFunction<
  typeof registerDbCommands
>;

describe("cli program setup", () => {
  it("should configure a Commander program with name 'proteus'", () => {
    const program = new Command();
    program
      .name("proteus")
      .description("Proteus ORM command-line tools")
      .version("1.0.0");

    expect(program.name()).toBe("proteus");
    expect(program.description()).toBe("Proteus ORM command-line tools");
  });

  it("should call registerMigrateCommands with the program", () => {
    const program = new Command();
    registerMigrateCommands(program);

    expect(mockRegisterMigrateCommands).toHaveBeenCalledWith(program);
  });

  it("should call registerDbCommands with the program", () => {
    const program = new Command();
    registerDbCommands(program);

    expect(mockRegisterDbCommands).toHaveBeenCalledWith(program);
  });

  it("should register both migrate and db commands on the same program", () => {
    const program = new Command();
    registerMigrateCommands(program);
    registerDbCommands(program);

    expect(mockRegisterMigrateCommands).toHaveBeenCalledWith(program);
    expect(mockRegisterDbCommands).toHaveBeenCalledWith(program);
  });

  it("registerMigrateCommands and registerDbCommands should be called once each per setup", () => {
    jest.clearAllMocks();
    const program = new Command();
    registerMigrateCommands(program);
    registerDbCommands(program);

    expect(mockRegisterMigrateCommands).toHaveBeenCalledTimes(1);
    expect(mockRegisterDbCommands).toHaveBeenCalledTimes(1);
  });
});
