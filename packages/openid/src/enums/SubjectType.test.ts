import { describe, expect, test } from "vitest";
import { SubjectType } from "./SubjectType.js";

describe("SubjectType", () => {
  test("should match snapshot", () => {
    expect(SubjectType).toMatchSnapshot();
  });

  test("should carry the OIDC Core section 8 values, not the deleted type's bug", () => {
    expect(Object.values(SubjectType)).toEqual(["pairwise", "public"]);
    expect(Object.values(SubjectType)).not.toContain("client");
    expect(Object.values(SubjectType)).not.toContain("identity");
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: SubjectType = SubjectType.Pairwise;
    const fromLiteral: SubjectType = "public";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
