import { describe, expect, test } from "vitest";
import { withJoseDates } from "./jose-dates.js";

describe("withJoseDates", () => {
  test("lifts every NumericDate temporal claim to a Date", () => {
    expect(
      withJoseDates({
        exp: 1700000000,
        iat: 1600000000,
        nbf: 1650000000,
        auth_time: 1500000000,
      }),
    ).toMatchSnapshot();
  });

  test("leaves every non-temporal claim exactly as the wire carried it", () => {
    // The matcher payload is a LIFTED VIEW, never a rewrite: a claim this does not
    // name must survive byte-for-byte, including one that merely looks temporal.
    expect(
      withJoseDates({ sub: "user-1", aud: ["a", "b"], updated_at: 1600000000 }),
    ).toMatchSnapshot();
  });

  test("reports an ABSENT temporal claim as undefined rather than the epoch", () => {
    // The matchers ask "is it present?" before they ask "is it in range?", so a
    // missing exp must not arrive as 1970 — that would read as long expired.
    expect(withJoseDates({ sub: "user-1" })).toMatchSnapshot();
  });

  test("reports a ZERO temporal claim as undefined, the same as an absent one", () => {
    // `0` is a legal NumericDate but never a date a token means; both wires have
    // always treated it as "not present".
    expect(withJoseDates({ exp: 0, iat: 0, nbf: 0, auth_time: 0 })).toMatchSnapshot();
  });

  test("does not mutate the payload it was given", () => {
    const payload = { exp: 1700000000, sub: "user-1" };

    withJoseDates(payload);

    expect(payload.exp).toBe(1700000000);
  });
});
