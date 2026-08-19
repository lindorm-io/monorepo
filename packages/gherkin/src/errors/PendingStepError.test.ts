import { LindormError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import { GherkinError } from "./GherkinError.js";
import { PendingStepError } from "./PendingStepError.js";

describe("PendingStepError", () => {
  test("should be a GherkinError", () => {
    expect(new PendingStepError()).toEqual(expect.any(GherkinError));
    expect(new PendingStepError()).toEqual(expect.any(LindormError));
  });

  test("should carry the pending_step code and type urn", () => {
    const error = new PendingStepError();

    expect(error.code).toEqual("pending_step");
    expect(error.type).toEqual("urn:lindorm:gherkin:error:pending_step");
  });

  test("should use the default message", () => {
    const error = new PendingStepError();

    expect({
      code: error.code,
      details: error.details,
      message: error.message,
      title: error.title,
      type: error.type,
    }).toMatchSnapshot();
  });

  test("should accept a custom message", () => {
    expect(new PendingStepError("custom").message).toEqual("custom");
  });
});
