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

  // `invalid` names the TOP-LEVEL entries of the predicate. A root operator has
  // no claim of its own to read, so the diagnosis evaluates each entry against
  // the whole dict — a `$not` that fails is named `$not`, and a failing claim
  // key is named under its own key.
  test("names a failing root $not under its own key", () => {
    expect(() =>
      validate(
        { one: "a", two: "b" },
        { $not: { one: { $eq: "a" } }, two: { $eq: "b" } },
        AegisDomainError,
        "claims_invalid",
      ),
    ).toThrow(expect.objectContaining({ data: { invalid: ["$not"] } }));
  });

  test("does not name a root $and that holds beside a failing claim key", () => {
    expect(() =>
      validate(
        { one: "a", two: "b" },
        { $and: [{ one: { $eq: "a" } }, { two: { $eq: "b" } }], two: { $eq: "x" } },
        AegisDomainError,
        "claims_invalid",
      ),
    ).toThrow(expect.objectContaining({ data: { invalid: ["two"] } }));
  });

  test("does not name a root $or that a later member satisfies", () => {
    expect(() =>
      validate(
        { one: "a", two: "b" },
        { $or: [{ one: { $eq: "x" } }, { one: { $eq: "a" } }], two: { $eq: "z" } },
        AegisDomainError,
        "claims_invalid",
      ),
    ).toThrow(expect.objectContaining({ data: { invalid: ["two"] } }));
  });
});
