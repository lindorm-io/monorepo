import { describe, expect, test } from "vitest";
import { ClaimType } from "./ClaimType.js";

describe("ClaimType", () => {
  test("should match snapshot", () => {
    expect(ClaimType).toMatchSnapshot();
  });

  test("should carry the OIDC Core section 5.6 claim types", () => {
    expect(Object.values(ClaimType)).toEqual(["normal", "aggregated", "distributed"]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: ClaimType = ClaimType.Normal;
    const fromLiteral: ClaimType = "distributed";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
