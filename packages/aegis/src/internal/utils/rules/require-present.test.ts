import { describe, expect, test } from "vitest";
import { requirePresent } from "./require-present.js";

describe("requirePresent", () => {
  test("returns no entries when all required claims are present", () => {
    expect(requirePresent({ sub: "a", exp: 1 }, ["sub", "exp"], new Set())).toEqual([]);
  });

  test("returns an entry per missing claim", () => {
    expect(
      requirePresent({ sub: "a" }, ["sub", "exp", "iss"], new Set()),
    ).toMatchSnapshot();
  });

  test.each([
    ["audience", []],
    ["scope", []],
    ["confirmation", {}],
    ["act", {}],
    ["mayAct", {}],
    ["authorizationDetails", []],
  ])("an empty %s does not satisfy a demand for it", (key, value) => {
    expect(requirePresent({ [key]: value }, [key], new Set())).toMatchSnapshot();
  });

  test.each([
    ["the empty string", ""],
    ["undefined", undefined],
    ["null", null],
  ])("a required claim held as %s gets the entry an absent one gets", (_label, value) => {
    const held = requirePresent({ subject: value }, ["subject"], new Set());

    expect(held).toEqual(requirePresent({}, ["subject"], new Set()));
    expect(held).toMatchSnapshot();
  });

  test("a claim the writer would leave off the wire is reported as not of its declared type", () => {
    expect(requirePresent({ subject: 42 }, ["subject"], new Set(["subject"]))).toEqual([
      { key: "subject", message: 'Required claim "subject" is not of its declared type' },
    ]);
  });

  test("reports an unreadable claim and a missing claim in one call, in key order", () => {
    expect(
      requirePresent({ subject: 42 }, ["issuer", "subject"], new Set(["subject"])),
    ).toEqual([
      { key: "issuer", message: 'Required claim "issuer" is missing or empty' },
      { key: "subject", message: 'Required claim "subject" is not of its declared type' },
    ]);
  });
});
