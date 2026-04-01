import type { HermesRegistry } from "#internal/registry";
import type { HermesCommandMessage, HermesEventMessage } from "#internal/messages";
import { recoverCommand, recoverEvent } from "./recover-dto";

class FakeCommand {
  public input: string = "";
}

class FakeEvent {
  public value: string = "";
}

const createMockRegistry = (): HermesRegistry => {
  const commandMap = new Map<string, { target: any }>([
    ["test_command_create", { target: FakeCommand }],
  ]);
  const eventMap = new Map<string, { target: any }>([
    ["test_event_create", { target: FakeEvent }],
  ]);

  return {
    getCommandByName: (name: string) => {
      const entry = commandMap.get(name);
      if (!entry) throw new Error(`Command not found: ${name}`);
      return entry;
    },
    getEventByName: (name: string) => {
      const entry = eventMap.get(name);
      if (!entry) throw new Error(`Event not found: ${name}`);
      return entry;
    },
  } as unknown as HermesRegistry;
};

describe("recoverCommand", () => {
  test("should hydrate a command DTO instance from message data", () => {
    const registry = createMockRegistry();
    const message = {
      name: "test_command_create",
      data: { input: "hello" },
    } as unknown as HermesCommandMessage;

    const result = recoverCommand(registry, message);

    expect(result).toBeInstanceOf(FakeCommand);
    expect(result.input).toBe("hello");
  });

  test("should throw when command name is not registered", () => {
    const registry = createMockRegistry();
    const message = {
      name: "nonexistent_command",
      data: {},
    } as unknown as HermesCommandMessage;

    expect(() => recoverCommand(registry, message)).toThrow(
      "Command not found: nonexistent_command",
    );
  });
});

describe("recoverEvent", () => {
  test("should hydrate an event DTO instance from message data", () => {
    const registry = createMockRegistry();
    const message = {
      name: "test_event_create",
      data: { value: "world" },
    } as unknown as HermesEventMessage;

    const result = recoverEvent(registry, message);

    expect(result).toBeInstanceOf(FakeEvent);
    expect(result.value).toBe("world");
  });

  test("should throw when event name is not registered", () => {
    const registry = createMockRegistry();
    const message = {
      name: "nonexistent_event",
      data: {},
    } as unknown as HermesEventMessage;

    expect(() => recoverEvent(registry, message)).toThrow(
      "Event not found: nonexistent_event",
    );
  });
});
