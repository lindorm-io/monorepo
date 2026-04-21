import { extractNameData } from "./extract-name-data.js";
import { describe, expect, it } from "vitest";

describe("extractNameData", () => {
  it("should extract snake_case name from PascalCase class name", () => {
    expect(extractNameData("TestCreateCommand")).toMatchSnapshot();
  });

  it("should extract version from _V2 suffix", () => {
    expect(extractNameData("TestCreateCommand_V2")).toMatchSnapshot();
  });

  it("should extract version from _v3 suffix (lowercase)", () => {
    expect(extractNameData("TestCreateCommand_v3")).toMatchSnapshot();
  });

  it("should default to version 1 when no suffix", () => {
    expect(extractNameData("TestCreateCommand")).toMatchSnapshot();
  });

  it("should handle single-word names", () => {
    expect(extractNameData("Command")).toMatchSnapshot();
  });

  it("should handle names with numbers in the body", () => {
    expect(extractNameData("V3ThirdTest")).toMatchSnapshot();
  });

  it("should only strip version suffix at the end", () => {
    const result = extractNameData("V3ThirdTest");

    expect(result.version).toBe(1);
  });

  it("should strip _V suffix and parse the digit", () => {
    const result = extractNameData("SomeAggregate_V5");

    expect(result.version).toBe(5);
  });

  it("should return snake_case name without the version suffix", () => {
    const result = extractNameData("SomeAggregate_V5");

    expect(result.name).toBe("some_aggregate");
  });

  it("should handle multi-digit version _V12", () => {
    const result = extractNameData("MyCommand_V12");

    expect(result.name).toBe("my_command");
    expect(result.version).toBe(12);
  });

  it("should handle multi-digit version _V99", () => {
    const result = extractNameData("SomeAggregate_V99");

    expect(result.name).toBe("some_aggregate");
    expect(result.version).toBe(99);
  });

  it("should handle multi-digit lowercase _v10", () => {
    const result = extractNameData("TestEvent_v10");

    expect(result.name).toBe("test_event");
    expect(result.version).toBe(10);
  });
});
