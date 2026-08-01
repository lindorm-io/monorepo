import { describe, expect, test } from "vitest";
import { LindormScope, Scope, StandardScope } from "./Scope.js";

describe("Scope", () => {
  test("should match snapshot", () => {
    expect(Scope).toMatchSnapshot();
  });

  test("should carry the OIDC standard scope values", () => {
    expect(Object.values(StandardScope)).toEqual([
      "address",
      "email",
      "offline_access",
      "openid",
      "phone",
      "profile",
    ]);
  });

  test("should compose from the lindorm and standard sets without duplicating a value", () => {
    expect(Object.values(Scope)).toEqual([
      ...Object.values(LindormScope),
      ...Object.values(StandardScope),
    ]);
    expect(new Set(Object.values(Scope)).size).toBe(Object.values(Scope).length);
  });

  test("should keep the lindorm extensions disjoint from the standard set", () => {
    const standard = new Set<string>(Object.values(StandardScope));

    expect(Object.values(LindormScope).filter((s) => standard.has(s))).toEqual([]);
  });

  test("should derive the type from the runtime values", () => {
    const fromEnum: Scope = Scope.OpenId;
    const fromLindorm: LindormScope = LindormScope.WorkProfile;
    const fromStandard: StandardScope = "offline_access";
    const extension: Scope = "urn:example:scope";

    expect([fromEnum, fromLindorm, fromStandard, extension]).toMatchSnapshot();
  });
});
