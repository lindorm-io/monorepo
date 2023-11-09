import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { getLevelOfAssuranceFromAuthenticationLevel } from "./get-level-of-assurance-from-authentication-level";

describe("getVerifiedAcrValues", () => {
  test("should resolve 4", () => {
    expect(
      getLevelOfAssuranceFromAuthenticationLevel([
        AuthenticationFactor.ONE_FACTOR,
        AuthenticationMethod.PASSWORD,
        AuthenticationStrategy.PHONE_CODE,
        AuthenticationLevel.LOA_2,
        AuthenticationLevel.LOA_4,
      ]),
    ).toBe(4);
  });

  test("should resolve 3", () => {
    expect(
      getLevelOfAssuranceFromAuthenticationLevel([
        AuthenticationLevel.LOA_2,
        AuthenticationLevel.LOA_3,
      ]),
    ).toBe(3);
  });

  test("should resolve 2", () => {
    expect(
      getLevelOfAssuranceFromAuthenticationLevel([
        AuthenticationLevel.LOA_1,
        AuthenticationLevel.LOA_2,
      ]),
    ).toBe(2);
  });

  test("should resolve 1", () => {
    expect(getLevelOfAssuranceFromAuthenticationLevel([AuthenticationLevel.LOA_1])).toBe(1);
  });

  test("should resolve 0", () => {
    expect(
      getLevelOfAssuranceFromAuthenticationLevel([
        AuthenticationFactor.ONE_FACTOR,
        AuthenticationMethod.PASSWORD,
        AuthenticationStrategy.PHONE_CODE,
      ]),
    ).toBe(0);
  });
});
