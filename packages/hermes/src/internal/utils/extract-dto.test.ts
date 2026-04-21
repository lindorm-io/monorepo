import { extractDto } from "./extract-dto.js";
import { TestCommandCreate } from "../../__fixtures__/modules/commands/index.js";
import { TestEventCreate } from "../../__fixtures__/modules/events/index.js";
import { describe, expect, test } from "vitest";

describe("extractDto", () => {
  test("should extract name, version, and data from a DTO instance", () => {
    class TestCommandCreateLocal {
      public input: string;
      public constructor(input: string) {
        this.input = input;
      }
    }

    const dto = new TestCommandCreateLocal("hello");

    expect(extractDto(dto)).toMatchSnapshot();
  });

  test("should spread all enumerable properties as data", () => {
    class TestEventUpdate {
      public input: string;
      public extra: number;
      public constructor(input: string, extra: number) {
        this.input = input;
        this.extra = extra;
      }
    }

    const dto = new TestEventUpdate("world", 42);

    expect(extractDto(dto)).toMatchSnapshot();
  });

  test("should handle DTO with no properties (empty data object)", () => {
    class TestCommandEmpty {}

    const dto = new TestCommandEmpty();

    expect(extractDto(dto)).toMatchSnapshot();
  });

  test("should extract version from class name suffix", () => {
    class TestCommandCreate_V2 {
      public input: string;
      public constructor(input: string) {
        this.input = input;
      }
    }

    const dto = new TestCommandCreate_V2("versioned");
    const result = extractDto(dto);

    expect(result.version).toBe(2);
    expect(result.name).toBe("test_command_create");
  });

  // M3: decorator metadata should take precedence over class name

  test("should use decorator metadata name and version when available (M3)", () => {
    const dto = new TestCommandCreate("decorated");
    const result = extractDto(dto);

    // TestCommandCreate has @Command() decorator which stages dto metadata
    // The name should come from decorator (snakeCase of class name by default)
    expect(result.name).toBe("test_command_create");
    expect(result.version).toBe(1);
    expect(result.data).toEqual({ input: "decorated" });
  });

  test("should use decorator metadata for events (M3)", () => {
    const dto = new TestEventCreate("event-data");
    const result = extractDto(dto);

    expect(result.name).toBe("test_event_create");
    expect(result.version).toBe(1);
    expect(result.data).toEqual({ input: "event-data" });
  });
});
