import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { getVerifiedAcrValues } from "./get-verified-acr-values";

describe("getVerifiedAcrValues", () => {
  test("should resolve for valid authentication factors", () => {
    expect(getVerifiedAcrValues(Object.values(AuthenticationFactor))).toStrictEqual(
      Object.values(AuthenticationFactor),
    );
  });

  test("should resolve for valid authentication methods", () => {
    expect(getVerifiedAcrValues(Object.values(AuthenticationMethod))).toStrictEqual(
      Object.values(AuthenticationMethod),
    );
  });

  test("should resolve for valid authentication strategies", () => {
    expect(getVerifiedAcrValues(Object.values(AuthenticationStrategy))).toStrictEqual(
      Object.values(AuthenticationStrategy),
    );
  });

  test("should resolve for valid levels of assurance", () => {
    expect(getVerifiedAcrValues(Object.values(AuthenticationLevel))).toStrictEqual(
      Object.values(AuthenticationLevel),
    );
  });

  test("should throw error for invalid values", () => {
    expect(() => getVerifiedAcrValues(["invalid"])).toThrow();
  });
});
