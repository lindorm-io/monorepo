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

  test("should render the code above a runner-owned failure and none for a codeless error", () => {
    const rendered = formatAdditionalFailures([
      new Error("@AfterStep hook failed\n\n  AesHooks.capture\n\nboom"),
      new GherkinError("Context class AesContext dispose() threw\n\nclosed", {
        code: "disposal_failed",
      }),
    ]);

    expect(rendered).toContain("disposal_failed");
    expect(rendered).toMatchSnapshot();
  });

  test("should render a consumer error's own code", () => {
    const failure = new Error("no such file or directory") as Error & { code: string };
    failure.code = "ENOENT";

    expect(formatAdditionalFailures([failure])).toContain("ENOENT");
  });

  test("should render no code line when the code is not a string", () => {
    const failure = new Error("boom") as Error & { code: number };
    failure.code = 42;

    expect(formatAdditionalFailures([failure])).not.toContain("42");
  });
});
