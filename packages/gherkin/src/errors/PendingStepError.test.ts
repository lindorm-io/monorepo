import { describe, expect, test } from "vitest";
import { GherkinError } from "./GherkinError.js";
import { PendingStepError } from "./PendingStepError.js";

describe("PendingStepError", () => {
  test("should be a GherkinError", () => {
    expect(new PendingStepError()).toEqual(expect.any(GherkinError));
  });

  test("should carry the pending_step code", () => {
    expect(new PendingStepError().code).toEqual("pending_step");
  });

  test("should use the default message", () => {
    const error = new PendingStepError();

    expect({
      code: error.code,
      details: error.details,
      message: error.message,
    }).toMatchSnapshot();
  });

  test("should accept a custom message", () => {
    expect(new PendingStepError("custom").message).toEqual("custom");
  });
});
