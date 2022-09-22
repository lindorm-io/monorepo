import { filterAcrValues } from "./filter-acr-values";

describe("filterAcrValues", () => {
  test("should resolve all desired values", () => {
    expect(
      filterAcrValues({
        acrValues: "LOA_3 session email phone",
        amrValues: "email",
        acrArray: ["loa_3"],
        amrArray: ["email", "phone"],
      }),
    ).toStrictEqual({
      methods: expect.arrayContaining(["session", "email", "phone"]),
      levelOfAssurance: 3,
    });
  });

  test("should skip level of assurance", () => {
    expect(
      filterAcrValues({
        acrValues: "email phone",
      }),
    ).toStrictEqual({
      methods: ["email", "phone"],
      levelOfAssurance: 0,
    });
  });

  test("should resolve the highest desired level of assurance", () => {
    expect(
      filterAcrValues({
        acrValues: "LOA_3 2 LOA_1 LOA_2 1 LOA_4 3",
      }),
    ).toStrictEqual({
      methods: [],
      levelOfAssurance: 4,
    });
  });

  test("should filter out duplicates from methods", () => {
    expect(
      filterAcrValues({
        amrValues: "email email phone phone",
      }),
    ).toStrictEqual({
      methods: ["email", "phone"],
      levelOfAssurance: 0,
    });
  });

  test("should resolve with array", () => {
    expect(
      filterAcrValues({
        acrArray: ["loa_4"],
        amrArray: ["email", "phone"],
      }),
    ).toStrictEqual({
      methods: ["email", "phone"],
      levelOfAssurance: 4,
    });
  });

  test("should resolve with null", () => {
    expect(filterAcrValues()).toStrictEqual({
      methods: [],
      levelOfAssurance: 0,
    });
  });
});
