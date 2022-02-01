import { filterAcrValues } from "./filter-acr-values";

describe("filterAcrValues", () => {
  test("should resolve all desired values", () => {
    expect(
      filterAcrValues(
        "LOA_3 session_otp email_otp phone_otp",
        ["loa_3"],
        ["email_otp", "phone_otp"],
      ),
    ).toStrictEqual({
      authenticationMethods: ["session_otp", "email_otp", "phone_otp"],
      levelOfAssurance: 3,
    });
  });

  test("should skip level of assurance", () => {
    expect(filterAcrValues("email_otp phone_otp")).toStrictEqual({
      authenticationMethods: ["email_otp", "phone_otp"],
      levelOfAssurance: 0,
    });
  });

  test("should resolve the highest desired level of assurance", () => {
    expect(filterAcrValues("LOA_3 2 LOA_1 LOA_2 1 LOA_4 3")).toStrictEqual({
      authenticationMethods: [],
      levelOfAssurance: 4,
    });
  });

  test("should filter out duplicates from methods", () => {
    expect(filterAcrValues("email_otp email_otp phone_otp phone_otp")).toStrictEqual({
      authenticationMethods: ["email_otp", "phone_otp"],
      levelOfAssurance: 0,
    });
  });

  test("should resolve with array", () => {
    expect(filterAcrValues(null, ["loa_4"], ["email_otp", "phone_otp"])).toStrictEqual({
      authenticationMethods: ["email_otp", "phone_otp"],
      levelOfAssurance: 4,
    });
  });

  test("should resolve with null", () => {
    expect(filterAcrValues(null)).toStrictEqual({
      authenticationMethods: [],
      levelOfAssurance: 0,
    });
  });
});
