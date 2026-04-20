import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { guardMemoryLockMode } from "./guard-memory-lock-mode";
import { describe, expect, test } from "vitest";

describe("guardMemoryLockMode", () => {
  test("should allow pessimistic_read", () => {
    expect(() => guardMemoryLockMode("pessimistic_read")).not.toThrow();
  });

  test("should allow pessimistic_write", () => {
    expect(() => guardMemoryLockMode("pessimistic_write")).not.toThrow();
  });

  test("should throw for pessimistic_write_skip", () => {
    expect(() => guardMemoryLockMode("pessimistic_write_skip")).toThrow(
      NotSupportedError,
    );
    expect(() => guardMemoryLockMode("pessimistic_write_skip")).toThrow(
      'Lock mode "pessimistic_write_skip" is not supported by the Memory driver',
    );
  });

  test("should throw for pessimistic_write_fail", () => {
    expect(() => guardMemoryLockMode("pessimistic_write_fail")).toThrow(
      NotSupportedError,
    );
    expect(() => guardMemoryLockMode("pessimistic_write_fail")).toThrow(
      'Lock mode "pessimistic_write_fail" is not supported by the Memory driver',
    );
  });

  test("should throw for pessimistic_read_skip", () => {
    expect(() => guardMemoryLockMode("pessimistic_read_skip")).toThrow(NotSupportedError);
    expect(() => guardMemoryLockMode("pessimistic_read_skip")).toThrow(
      'Lock mode "pessimistic_read_skip" is not supported by the Memory driver',
    );
  });

  test("should throw for pessimistic_read_fail", () => {
    expect(() => guardMemoryLockMode("pessimistic_read_fail")).toThrow(NotSupportedError);
    expect(() => guardMemoryLockMode("pessimistic_read_fail")).toThrow(
      'Lock mode "pessimistic_read_fail" is not supported by the Memory driver',
    );
  });
});
