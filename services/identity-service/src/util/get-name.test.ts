import { getName } from "./get-name";
import { Identity } from "../entity";
import { NamingSystem } from "../enum";

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
          takenName: "takenName",
        }),
      ),
    ).toBe("takenName familyName");
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

  test("should resolve takenName", () => {
    expect(
      getName(
        new Identity({
          takenName: "takenName",
          givenName: "givenName",
        }),
      ),
    ).toBe("takenName");
  });
});
