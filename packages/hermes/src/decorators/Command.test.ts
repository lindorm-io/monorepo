import { globalHermesMetadata } from "../utils/private";
import { Command } from "./Command";

describe("Command Decorator", () => {
  test("should add metadata", () => {
    @Command()
    class TestCommand {}

    expect(globalHermesMetadata.getCommand(TestCommand)).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @Command({ name: "custom_command" })
    class TestCommandOptions {}

    expect(globalHermesMetadata.getCommand(TestCommandOptions)).toMatchSnapshot();
  });
});
