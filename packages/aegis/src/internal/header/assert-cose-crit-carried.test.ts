import { describe, expect, test } from "vitest";
import { CweError, CwtError } from "../../errors/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { assertCoseCritCarried } from "./assert-cose-crit-carried.js";

/**
 * The COSE `crit` presence rule, asked on the RAW label map — the one vocabulary
 * where the integer `7` and the text `"7"` are still different keys
 * (RFC 9052 §1.5, RFC 9052 §3.1).
 *
 * The doors that run it are pinned where they live:
 * `custom-header-params.read.test.ts` (verify), `cose-token-wire.test.ts` (parse)
 * and `CweKit.test.ts` (decrypt).
 */
describe("assertCoseCritCarried", () => {
  const bucket = (entries: Array<[CoseLabel, unknown]>): Map<CoseLabel, unknown> =>
    new Map(entries);

  const refusalOf = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (error) {
      const { code, message, data } = error as {
        code?: string;
        message?: string;
        data?: { parameter?: unknown };
      };
      return { code, message, parameter: data?.parameter };
    }

    throw new Error("expected a refusal");
  };

  const assert = (entries: Array<[CoseLabel, unknown]>): void =>
    assertCoseCritCarried({
      bucket: bucket(entries),
      format: "cwt",
      error: CwtError,
    });

  test("accepts an integer crit member the integer label carries", () => {
    expect(() =>
      assert([
        [2, [-5885]],
        [-5885, "v"],
      ]),
    ).not.toThrow();
  });

  test("accepts a text crit member the text label carries", () => {
    expect(() =>
      assert([
        [2, ["x-hint"]],
        ["x-hint", "v"],
      ]),
    ).not.toThrow();
  });

  test("refuses an integer crit member whose only twin is the text label", () => {
    expect(
      refusalOf(() =>
        assert([
          [2, [-5885]],
          ["-5885", "v"],
        ]),
      ),
    ).toEqual({
      code: "cwt_invalid_crit",
      message:
        "Invalid crit header: crit listed integer label -5885, which the protected header does not carry",
      parameter: -5885,
    });
  });

  test("refuses a text crit member whose only twin is the integer label", () => {
    expect(
      refusalOf(() =>
        assert([
          [2, ["7"]],
          [7, "v"],
        ]),
      ),
    ).toEqual({
      code: "cwt_invalid_crit",
      message:
        'Invalid crit header: crit listed text label "7", which the protected header does not carry',
      parameter: "7",
    });
  });

  test("refuses a crit member the bucket carries under no label at all", () => {
    expect(refusalOf(() => assert([[2, ["x-hint"]]]))).toMatchObject({
      code: "cwt_invalid_crit",
      parameter: "x-hint",
    });
  });

  // A label is an int or a tstr and nothing else (RFC 9052 §1.5), so a member of
  // any other type matches no key — reported as the member it is rather than
  // forced into a label space it does not belong to.
  test("refuses a crit member that is neither label form", () => {
    expect(refusalOf(() => assert([[2, [true]]]))).toEqual({
      code: "cwt_invalid_crit",
      message:
        "Invalid crit header: crit listed member true, which the protected header does not carry",
      parameter: true,
    });
  });

  test("refuses the FIRST uncarried member, with the whole crit in data", () => {
    const error = (() => {
      try {
        assert([
          [2, ["x-first", "x-second"]],
          ["x-second", "v"],
        ]);
      } catch (caught) {
        return caught as { data: { crit: unknown; parameter: unknown } };
      }

      throw new Error("expected a refusal");
    })();

    expect(error.data).toEqual({
      crit: ["x-first", "x-second"],
      parameter: "x-first",
    });
  });

  // `validateCrit` owns the malformed shapes on the merged view, so a non-array
  // and an absent crit leave this gate with nothing to say.
  test("says nothing about a crit that is not an array", () => {
    expect(() => assert([[2, "x-hint"]])).not.toThrow();
  });

  test("says nothing about a bucket with no crit", () => {
    expect(() => assert([[1, -7]])).not.toThrow();
  });

  // A list at the tstr `"crit"` can reach the merged view through the custom bag
  // (`written-header.ts`), so it is judged by the label rule here too.
  test("judges the crit list at the text label as well as the one at integer label 2", () => {
    expect(refusalOf(() => assert([["crit", ["x-hint"]]]))).toMatchObject({
      code: "cwt_invalid_crit",
      parameter: "x-hint",
    });
  });

  test("accepts a text-labelled crit list whose member the bucket carries", () => {
    expect(() =>
      assert([
        ["crit", ["x-hint"]],
        ["x-hint", "v"],
      ]),
    ).not.toThrow();
  });

  test("refuses a text-labelled crit member whose only twin is the integer label", () => {
    expect(
      refusalOf(() =>
        assert([
          ["crit", ["7"]],
          [7, "v"],
        ]),
      ),
    ).toEqual({
      code: "cwt_invalid_crit",
      message:
        'Invalid crit header: crit listed text label "7", which the protected header does not carry',
      parameter: "7",
    });
  });

  // Both lists are judged, and the registered label's is judged first — the one
  // every conformant reader reads.
  test("reports the registered label's list when both labels carry a crit", () => {
    const error = (() => {
      try {
        assert([
          [2, ["x-signed"]],
          ["crit", ["x-appended"]],
        ]);
      } catch (caught) {
        return caught as { data: { crit: unknown; parameter: unknown } };
      }

      throw new Error("expected a refusal");
    })();

    expect(error.data).toEqual({ crit: ["x-signed"], parameter: "x-signed" });
  });

  // Nothing downstream answers for the text list when the integer one is carried:
  // `written-header.ts` spreads the registered bag last, so the merged view reports
  // the integer label's list and the text one is judged nowhere else.
  test("judges the text label's list when every member of the integer label's is carried", () => {
    const error = (() => {
      try {
        assert([
          [2, ["x-a"]],
          ["x-a", "v"],
          ["crit", ["7"]],
          [7, "v"],
        ]);
      } catch (caught) {
        return caught as { code: string; data: { crit: unknown; parameter: unknown } };
      }

      throw new Error("expected a refusal");
    })();

    expect(error.code).toBe("cwt_invalid_crit");
    expect(error.data).toEqual({ crit: ["7"], parameter: "7" });
  });

  test("names the format it was given, so each door refuses under its own code", () => {
    expect(
      refusalOf(() =>
        assertCoseCritCarried({
          bucket: bucket([[2, ["x-hint"]]]),
          format: "cwe",
          error: CweError,
        }),
      ),
    ).toMatchObject({ code: "cwe_invalid_crit" });
  });
});
