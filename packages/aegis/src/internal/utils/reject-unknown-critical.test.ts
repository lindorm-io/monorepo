import { describe, expect, test } from "vitest";
import { CwtError, JwtError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";

const header = (extra: Record<string, unknown>): WireTokenHeader =>
  ({ alg: "ES512", ...extra }) as WireTokenHeader;

const reject = (extra: Record<string, unknown>) => (): void =>
  rejectUnknownCritical({ header: header(extra), format: "jwt", error: JwtError });

describe("rejectUnknownCritical", () => {
  test("accepts a header with no crit at all", () => {
    expect(reject({})).not.toThrow();
  });

  test("refuses an extension it does not implement", () => {
    // aegis implements NO crit extension, so every member is unrecognised.
    expect(reject({ crit: ["oid"], oid: "1.2.3.4" })).toThrow(
      expect.objectContaining({
        code: "jwt_unsupported_crit_param",
        data: { param: "oid" },
      }),
    );
  });

  test("reports the FIRST member — there is no subset that could be understood", () => {
    // Both members are real, present and NOT IANA-registered, so both clear the
    // malformed branch and the unrecognised one is what answers.
    expect(reject({ crit: ["oid", "ext"], oid: "1.2.3.4", ext: "x" })).toThrow(
      expect.objectContaining({ data: { param: "oid" } }),
    );
  });

  test("refuses a MALFORMED crit distinctly from an unrecognised one", () => {
    // The distinction is what makes a refusal attributable: a token refused for
    // being malformed says nothing about whether aegis implements the extension.
    for (const crit of [[], "oid", [1]]) {
      expect(reject({ crit })).toThrow(
        expect.objectContaining({ code: "jwt_invalid_crit" }),
      );
    }
  });

  test("refuses a crit naming a parameter that is not in the header it was read from", () => {
    // RFC 7515 §4.1.11 and RFC 9052 §3.1 both make this fatal — on COSE in those
    // exact words. On COSE the header handed in is the PROTECTED bucket, so this
    // is also what refuses a crit member whose parameter rode the unsigned one.
    expect(reject({ crit: ["oid"] })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("refuses a crit naming a parameter carried with an EMPTY value as MALFORMED", () => {
    // ⚠ MALFORMED, not unrecognised, and the distinction is the point. `crit`
    // says a recipient must understand the parameter's VALUE; an empty one gives
    // it nothing to understand, so the header is broken before the question of
    // whether aegis implements the extension arises. Both refuse — this one says
    // why more accurately.
    expect(reject({ crit: ["oid"], oid: "" })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("refuses a crit naming an IANA-registered parameter (crit is for extensions)", () => {
    expect(reject({ crit: ["alg"] })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("namespaces both codes by the FORMAT, so a refusal names the wire it came from", () => {
    // The same implementation serves both wires; only the format tag and the
    // error class differ. That is the whole point — a hostile token cannot be
    // refused on one wire and accepted on the other.
    expect(() =>
      rejectUnknownCritical({
        header: header({ crit: ["oid"], oid: "1.2.3.4" }),
        format: "cwt",
        error: CwtError,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "cwt_unsupported_crit_param",
        data: { param: "oid" },
      }),
    );
  });
});
