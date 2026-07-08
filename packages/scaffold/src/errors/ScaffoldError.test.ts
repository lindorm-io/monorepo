import { describe, expect, test } from "vitest";
import { ScaffoldError } from "./ScaffoldError.js";

describe("ScaffoldError", () => {
  test("builds a urn:lindorm:scaffold error type from the code", () => {
    const error = new ScaffoldError("Something failed", {
      code: "target_unresolved",
      title: "Target directory unresolved",
      details: "No target directory was resolved.",
    });

    expect(error).toBeInstanceOf(ScaffoldError);
    expect(error.type).toBe("urn:lindorm:scaffold:error:target_unresolved");
    expect({
      code: error.code,
      details: error.details,
      message: error.message,
      name: error.name,
      title: error.title,
      type: error.type,
    }).toMatchSnapshot();
  });
});
