import { LindormError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import { GherkinError } from "./GherkinError.js";

describe("GherkinError", () => {
  test("should be a LindormError", () => {
    expect(new GherkinError("message")).toEqual(expect.any(LindormError));
  });

  test("should set name to GherkinError", () => {
    expect(new GherkinError("message").name).toEqual("GherkinError");
  });

  test("should derive the type urn from the code under the gherkin namespace", () => {
    expect(new GherkinError("message", { code: "scope_violation" }).type).toEqual(
      "urn:lindorm:gherkin:error:scope_violation",
    );
  });

  test("should carry code, data, debug, title and details", () => {
    const error = new GherkinError("message", {
      code: "custom_code",
      data: { value: "data" },
      debug: { value: "debug" },
      details: "details",
      title: "title",
    });

    expect({
      code: error.code,
      data: error.data,
      debug: error.debug,
      details: error.details,
      message: error.message,
      title: error.title,
      type: error.type,
    }).toMatchSnapshot();
  });
});
