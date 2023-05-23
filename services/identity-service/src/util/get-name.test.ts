import { NamingSystem } from "@lindorm-io/common-types";
import { Identity } from "../entity";
import { getName } from "./get-name";

describe("getName", () => {
  test("should resolve GIVEN_FAMILY", () => {
    expect(
      getName(
        new Identity({
          givenName: "givenName",
          familyName: "familyName",
          namingSystem: NamingSystem.GIVEN_FAMILY,
        }),
      ),
    ).toBe("givenName familyName");
  });

  test("should resolve FAMILY_GIVEN", () => {
    expect(
      getName(
        new Identity({
          givenName: "givenName",
          familyName: "familyName",
          namingSystem: NamingSystem.FAMILY_GIVEN,
        }),
      ),
    ).toBe("familyName givenName");
  });

  test("should resolve TAKEN_FAMILY", () => {
    expect(
      getName(
        new Identity({
          familyName: "familyName",
          givenName: "givenName",
          namingSystem: NamingSystem.GIVEN_FAMILY,
          preferredName: "preferredName",
        }),
      ),
    ).toBe("preferredName familyName");
  });

  test("should resolve givenName", () => {
    expect(
      getName(
        new Identity({
          givenName: "givenName",
        }),
      ),
    ).toBe("givenName");
  });

  test("should resolve familyName", () => {
    expect(
      getName(
        new Identity({
          familyName: "familyName",
        }),
      ),
    ).toBe("familyName");
  });

  test("should resolve preferredName", () => {
    expect(
      getName(
        new Identity({
          preferredName: "preferredName",
          givenName: "givenName",
        }),
      ),
    ).toBe("preferredName");
  });
});
