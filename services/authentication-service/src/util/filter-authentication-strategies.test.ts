import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { filterAuthenticationStrategies } from "./filter-authentication-strategies";

describe("filterAuthenticationStrategies", () => {
  test("should resolve only authentication strategies", () => {
    expect(
      filterAuthenticationStrategies([AuthenticationStrategy.EMAIL_CODE, "something", "wrong"]),
    ).toStrictEqual(["urn:lindorm:auth:strategy:email-code"]);
  });
});
