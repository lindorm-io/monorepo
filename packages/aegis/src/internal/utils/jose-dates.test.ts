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
    expect(
      withJoseDates({ sub: "user-1", aud: ["a", "b"], updated_at: 1600000000 }),
    ).toMatchSnapshot();
  });

  test("reports an ABSENT temporal claim as undefined rather than the epoch", () => {
    // The matchers ask "is it present?" before they ask "is it in range?", so a
    // missing exp must not arrive as 1970 — that would read as long expired.
    expect(withJoseDates({ sub: "user-1" })).toMatchSnapshot();
  });

  test("lifts a ZERO temporal claim to the epoch rather than reporting it absent", () => {
    expect(withJoseDates({ exp: 0, iat: 0, nbf: 0, auth_time: 0 })).toMatchSnapshot();
  });

  test("does not mutate the payload it was given", () => {
    const payload = { exp: 1700000000, sub: "user-1" };

    withJoseDates(payload);

    expect(payload.exp).toBe(1700000000);
  });
});
