import { describe, expect, test } from "vitest";
import { isAbortReason } from "./is-abort-reason.js";

describe("isAbortReason", () => {
  test("should return true for client-disconnect", () => {
    expect(isAbortReason({ kind: "client-disconnect" })).toMatchSnapshot();
  });

  test("should return true for request-timeout", () => {
    expect(isAbortReason({ kind: "request-timeout", timeoutMs: 1000 })).toMatchSnapshot();
  });

  test("should return true for server-shutdown", () => {
    expect(isAbortReason({ kind: "server-shutdown" })).toMatchSnapshot();
  });

  test("should return true for parent-aborted", () => {
    expect(isAbortReason({ kind: "parent-aborted" })).toMatchSnapshot();
  });

  test("should return true for rate-limit-exceeded", () => {
    expect(isAbortReason({ kind: "rate-limit-exceeded" })).toMatchSnapshot();
  });

  test("should return true for breaker-open", () => {
    expect(isAbortReason({ kind: "breaker-open" })).toMatchSnapshot();
  });

  test("should return true for manual", () => {
    expect(isAbortReason({ kind: "manual" })).toMatchSnapshot();
  });

  test("should return false for null", () => {
    expect(isAbortReason(null)).toMatchSnapshot();
  });

  test("should return false for undefined", () => {
    expect(isAbortReason(undefined)).toMatchSnapshot();
  });

  test("should return false for empty object", () => {
    expect(isAbortReason({})).toMatchSnapshot();
  });

  test("should return false for unknown kind", () => {
    expect(isAbortReason({ kind: "bogus" })).toMatchSnapshot();
  });

  test("should return false for a string", () => {
    expect(isAbortReason("string")).toMatchSnapshot();
  });

  test("should return false for a number", () => {
    expect(isAbortReason(42)).toMatchSnapshot();
  });
});
