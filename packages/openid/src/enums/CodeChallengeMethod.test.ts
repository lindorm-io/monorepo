import { describe, expect, test } from "vitest";
import { CodeChallengeMethod } from "./CodeChallengeMethod.js";

describe("CodeChallengeMethod", () => {
  test("should match snapshot", () => {
    expect(CodeChallengeMethod).toMatchSnapshot();
  });

  test("should carry the RFC 7636 section 4.2 values with exact casing", () => {
    expect(Object.values(CodeChallengeMethod)).toEqual(["plain", "S256"]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: CodeChallengeMethod = CodeChallengeMethod.S256;
    const fromLiteral: CodeChallengeMethod = "plain";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
