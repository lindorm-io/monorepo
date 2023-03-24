import { filterAuthenticationMethods } from "./filter-authentication-methods";
import { AuthenticationMethod } from "@lindorm-io/common-types";

describe("filterAuthenticationMethods", () => {
  test("should resolve only authentication methods", () => {
    expect(
      filterAuthenticationMethods([AuthenticationMethod.BANK_ID_SE, "something", "wrong"]),
    ).toStrictEqual(["bank_id_se"]);
  });
});
