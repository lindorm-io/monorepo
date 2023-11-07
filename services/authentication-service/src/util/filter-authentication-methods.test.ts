import { AuthenticationMethod } from "@lindorm-io/common-types";
import { filterAuthenticationMethods } from "./filter-authentication-methods";

describe("filterAuthenticationMethods", () => {
  test("should resolve only authentication methods", () => {
    expect(
      filterAuthenticationMethods([AuthenticationMethod.BANK_ID_SE, "something", "wrong"]),
    ).toStrictEqual(["urn:lindorm:auth:method:bank-id-se"]);
  });
});
