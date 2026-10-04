import { describe, expect, test } from "vitest";
import { AegisDomainError } from "../errors/index.js";
import { assertClaims } from "./assert-claims.js";
import { claimsMatch } from "./claims-match.js";

describe("claimsMatch / assertClaims refuse a matcher value no operator is lifted from", () => {
  const claims = { subject: "user-1" };
  const doors = { matches: claimsMatch, assert: assertClaims };

  test.each(
    (
      [
        ["null", null],
        ["a symbol", Symbol("x")],
      ] as const
    ).flatMap(([label, value]) =>
      (["matches", "assert"] as const).map((door) => [door, label, value] as const),
    ),
  )(
    "%s refuses %s under the wire-neutral code, title and type",
    (door, _label, value) => {
      let thrown: unknown;

      try {
        doors[door](claims, { subject: value } as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisDomainError);

      const { code, title, type, data, message } = thrown as AegisDomainError;

      expect({ code, title, type, data, message }).toMatchSnapshot();
    },
  );
});
