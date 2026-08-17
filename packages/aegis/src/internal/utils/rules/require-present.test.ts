import { describe, expect, test } from "vitest";
import { requirePresent } from "./require-present.js";

describe("requirePresent", () => {
  test("returns no entries when all required claims are present", () => {
    expect(requirePresent({ sub: "a", exp: 1 }, ["sub", "exp"])).toEqual([]);
  });

  test("returns an entry per missing claim", () => {
    expect(requirePresent({ sub: "a" }, ["sub", "exp", "iss"])).toMatchSnapshot();
  });

  /**
   * The six registry claims whose `whenEmpty: "keep"` cell carries their empty
   * form all the way to the wire, and whose empty form is a CONTAINER — the
   * shape the single presence predicate this replaces could not see, because it
   * counted `undefined | null | ""` alone.
   *
   * Each names nothing while satisfying a demand for it: `aud: []` addresses no
   * audience, `scope: []` conveys no grant, `cnf: {}` binds the token to no key
   * at all, the delegation pair names no actor and RFC 9396
   * `authorization_details: []` authorises nothing.
   *
   * The remaining five `"keep"` cells are deliberately absent: the three OIDC
   * hashes are b64url STRINGS whose `""` the old predicate already caught, and
   * `events`/`subjectId` are refused by `eventsShape` / `subIdShape`.
   */
  test.each([
    ["audience", []],
    ["scope", []],
    ["confirmation", {}],
    ["act", {}],
    ["mayAct", {}],
    ["authorizationDetails", []],
  ])("an empty %s does not satisfy a demand for it", (key, value) => {
    expect(requirePresent({ [key]: value }, [key])).toMatchSnapshot();
  });
});
