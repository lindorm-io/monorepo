import { describe, expect, test } from "vitest";
import { CLAIM_SPECS, coseName, joseName } from "../claims/claims-registry.js";
import { withSpacedArrays } from "./spaced-wire-arrays.js";

describe("withSpacedArrays", () => {
  test("lifts a spaced wire string to the list it spells, under either selector", () => {
    expect(withSpacedArrays({ scope: "read write" }, joseName)).toEqual({
      scope: ["read", "write"],
    });
    expect(withSpacedArrays({ scope: "read write" }, coseName)).toEqual({
      scope: ["read", "write"],
    });
  });

  test("lifts the empty string to the empty list", () => {
    expect(withSpacedArrays({ scope: "" }, joseName)).toEqual({ scope: [] });
  });

  // RFC 7519 §4.1.3 — the wire form is a string OR an array, and the string
  // names one audience.
  test("lifts a lone audience string to the one-element list it names, under either selector", () => {
    expect(withSpacedArrays({ aud: "https://rs.lindorm.io/" }, joseName)).toEqual({
      aud: ["https://rs.lindorm.io/"],
    });
    expect(withSpacedArrays({ aud: "https://rs.lindorm.io/" }, coseName)).toEqual({
      aud: ["https://rs.lindorm.io/"],
    });
  });

  // `roles` is a STRICT array, so its string form is not a list this helper may
  // invent boundaries for — it rides untouched and fails the matchers as itself.
  test("carries an array, a strict claim's scalar, and every other claim untouched", () => {
    const payload = {
      aud: ["https://rs.lindorm.io/"],
      scope: ["read"],
      roles: "admin editor",
      sub: "user-1",
    };

    expect(withSpacedArrays(payload, joseName)).toEqual(payload);
  });

  test("carries an audience that is neither a string nor a list untouched", () => {
    expect(withSpacedArrays({ aud: 42 }, joseName)).toEqual({ aud: 42 });
    expect(
      withSpacedArrays({ aud: { "0": "https://rs.lindorm.io/" } }, joseName),
    ).toEqual({
      aud: { "0": "https://rs.lindorm.io/" },
    });
  });

  // The population, from the registry itself: a claim starting to lift is a
  // deployment-visible change in what the caller's matcher is answered against.
  test("lifts the audience and scope claims alone", () => {
    const payload = Object.fromEntries(
      CLAIM_SPECS.map((spec) => [joseName(spec), "one two"]),
    );

    const lifted = withSpacedArrays(payload, joseName);

    expect(
      Object.keys(payload)
        .filter((key) => lifted[key] !== payload[key])
        .sort(),
    ).toEqual(["aud", "scope"]);
  });

  // ⚠ On COSE the matcher bag and the REPORTED wire payload are the SAME
  // object (`internal/wire/cose-token-wire.ts`), so the lift must copy: lifting
  // in place would rewrite the untranslated payload a verify result reports.
  test("leaves the input bag untouched", () => {
    const payload = { aud: "https://rs.lindorm.io/", scope: "read write", sub: "user-1" };
    const before = structuredClone(payload);

    withSpacedArrays(payload, joseName);

    expect(payload).toEqual(before);
  });
});
