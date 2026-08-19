import { describe, expect, test } from "vitest";
import { GherkinError } from "../../../errors/GherkinError.js";
import { formatAdditionalFailures } from "./format-additional-failures.js";

describe("formatAdditionalFailures", () => {
  test("should number one additional failure with singular phrasing", () => {
    expect(formatAdditionalFailures([new Error("dispose failed")])).toMatchSnapshot();
  });

  test("should align multi-line messages under their number", () => {
    expect(
      formatAdditionalFailures([
        new Error("@AfterStep hook failed\n\n  AesHooks.capture\n\nboom"),
        new Error("Context class AesContext dispose() threw\n\nclosed"),
      ]),
    ).toMatchSnapshot();
  });

  test("should render the urn type above a runner-owned failure and none for a consumer error", () => {
    const rendered = formatAdditionalFailures([
      new Error("@AfterStep hook failed\n\n  AesHooks.capture\n\nboom"),
      new GherkinError("Context class AesContext dispose() threw\n\nclosed", {
        code: "disposal_failed",
        title: "Context Disposal Failed",
      }),
    ]);

    expect(rendered).toContain("urn:lindorm:gherkin:error:disposal_failed");
    expect(rendered).toMatchSnapshot();
  });
});
