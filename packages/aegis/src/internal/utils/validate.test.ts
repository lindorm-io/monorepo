import { describe, expect, test } from "vitest";
import { AegisDomainError, AegisError, JwtError } from "../../errors/index.js";
import { validate } from "./validate.js";

describe("validate", () => {
  test("should validate", () => {
    expect(() =>
      validate(
        { one: "string" },
        { one: { $and: [{ $exists: true }, { $eq: "string" }] } },
        AegisDomainError,
        "claims_invalid",
      ),
    ).not.toThrow();
  });

  // `instanceof AegisError` IS this package's error interface — a consumer
  // branches on it to turn a token rejection into a 401. A failure raised here
  // that is not one falls straight through that guard and surfaces as a generic
  // 500 naming nothing.
  test("raises an AegisError whichever layer called it", () => {
    expect(() =>
      validate({ one: "a" }, { one: { $eq: "b" } }, AegisDomainError, "claims_invalid"),
    ).toThrow(AegisError);

    expect(() =>
      validate({ one: "a" }, { one: { $eq: "b" } }, JwtError, "jwt_claims_invalid"),
    ).toThrow(AegisError);
  });

  // The class and the code are the CALLER's, so a kit failure keeps its wire
  // spelling and a domain failure stays neutral. One shared body picking either
  // for everybody is what made a kit door report a domain error.
  test("attributes the failure to the layer that raised it", () => {
    expect(() =>
      validate({ one: "a" }, { one: { $eq: "b" } }, AegisDomainError, "claims_invalid"),
    ).toThrow(
      expect.objectContaining({
        code: "claims_invalid",
        data: { invalid: ["one"] },
      }),
    );

    expect(() =>
      validate({ one: "a" }, { one: { $eq: "b" } }, JwtError, "jwt_claims_invalid"),
    ).toThrow(expect.objectContaining({ code: "jwt_claims_invalid" }));
  });

  test("names every failing key, and only the failing ones", () => {
    expect(() =>
      validate(
        { one: "a", two: "b", three: "c" },
        { one: { $eq: "x" }, two: { $eq: "b" }, three: { $eq: "z" } },
        AegisDomainError,
        "claims_invalid",
      ),
    ).toThrow(expect.objectContaining({ data: { invalid: ["one", "three"] } }));
  });
});
