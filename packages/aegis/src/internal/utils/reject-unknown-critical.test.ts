import { describe, expect, test } from "vitest";
import { CwtError, JwtError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { HEADER_SPECS, headerJoseName } from "../header/header-registry.js";
import { isCritEligible } from "../header/is-crit-eligible.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";
import { validateCrit } from "./validate-crit.js";

const header = (extra: Record<string, unknown>): WireTokenHeader =>
  ({ alg: "ES512", ...extra }) as WireTokenHeader;

const reject = (extra: Record<string, unknown>) => (): void =>
  rejectUnknownCritical({ header: header(extra), format: "jwt", error: JwtError });

describe("rejectUnknownCritical", () => {
  test("accepts a header with no crit at all", () => {
    expect(reject({})).not.toThrow();
  });

  test("accepts the extension aegis implements", () => {
    // ⚠ THE COLUMN, NOT A CONSTANT. `oid` is `critEligible: true` in the header
    // registry, which is the SAME cell the mint gate refuses on — so a token
    // aegis mints with `crit: ["oid"]` is one aegis verifies. This function used
    // to throw unconditionally, which meant no crit-carrying token aegis
    // produced had ever verified on either wire.
    expect(reject({ crit: ["oid"], oid: "1.2.3.4" })).not.toThrow();
  });

  test("refuses an extension it does not implement", () => {
    // A name with no registry entry has no `critEligible` cell to be `true`, so
    // it is refused by the same lookup that accepts `oid`.
    expect(reject({ crit: ["ext"], ext: "x" })).toThrow(
      expect.objectContaining({
        code: "jwt_unsupported_crit_param",
        data: { param: "ext" },
      }),
    );
  });

  test("reports the first NON-ELIGIBLE member, not merely the first member", () => {
    // Both members are real, present and NOT IANA-registered, so both clear the
    // malformed branch. `oid` is understood and is skipped; naming it in the
    // refusal would report a parameter aegis has no complaint about.
    expect(reject({ crit: ["oid", "ext"], oid: "1.2.3.4", ext: "x" })).toThrow(
      expect.objectContaining({ data: { param: "ext" } }),
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

  /**
   * ⚠ A CALLER-CONTROLLED MEMBER IS LOOKED UP STRUCTURALLY. The eligibility
   * lookup is a `Map` read (`headerByJose`), which has no prototype chain — a
   * plain-object registry would answer for `"toString"` with a function, and
   * `fn?.critEligible === true` would only be false by luck. `crit: ["toString"]`
   * has got through this package's crit path twice.
   *
   * ⚠ These reach the ELIGIBILITY branch rather than the malformed one only
   * because the header carries the member: `validate-crit.ts` uses
   * `Object.hasOwn`, so a header that did NOT carry it would be refused as
   * malformed first and this branch would go unprobed.
   */
  test.each(["toString", "constructor", "valueOf", "hasOwnProperty"])(
    "refuses the Object.prototype member %s as an unsupported extension",
    (member) => {
      expect(reject({ crit: [member], [member]: "x" })).toThrow(
        expect.objectContaining({
          code: "jwt_unsupported_crit_param",
          data: { param: member },
        }),
      );
    },
  );

  /**
   * ⭐ THE TWO SOURCES, BOUND. `rejectUnknownCritical` runs `validateCrit`
   * FIRST, and `validateCrit` refuses every name in its own hand-written
   * `IANA_REGISTERED_JOSE_HEADER_PARAMS` list — a list nothing derives from the
   * registry. So "a token aegis mints is a token aegis verifies" holds only
   * while every `critEligible: true` parameter sits OUTSIDE that list, and
   * nothing said so.
   *
   * ⚠ Asserted BEHAVIOURALLY, through the real read path, rather than by
   * comparing two sets: what matters is not that the lists differ but that an
   * eligible parameter actually SURVIVES the read. A future parameter marked
   * eligible while also being IANA-registered would be minted by
   * `assert-crit-eligible.ts` and then refused on arrival as malformed — a token
   * aegis issues and will not read back — and this is what says so.
   *
   * ⚠ `b64` is the live warning. RFC 7797 §6 REQUIRES `crit: ["b64"]` on a
   * conformant unencoded-payload JWS, and the list refuses it; trimming the list
   * for that (an open item) must not quietly make an ineligible parameter
   * reachable here.
   */
  test("every crit-eligible parameter survives the read path's malformed gate", () => {
    const eligible = HEADER_SPECS.filter((spec) => isCritEligible(headerJoseName(spec)));

    expect(eligible.length, "no parameter is eligible, so this asserts nothing").toBe(1);

    for (const spec of eligible) {
      const jose = headerJoseName(spec);

      // A non-empty value under the parameter's own name is all `validateCrit`
      // requires beyond the name itself; the VALUE's shape is the codec's
      // business, not this gate's.
      expect(
        validateCrit({ crit: [jose], [jose]: "x" }),
        `crit: ["${jose}"] is eligible at mint but refused as malformed on read`,
      ).toBeNull();

      expect(reject({ crit: [jose], [jose]: "x" })).not.toThrow();
    }
  });

  /**
   * ⚠ WHY THE ELIGIBILITY BRANCH CANNOT BE PROBED FROM THIS DOOR, pinned as the
   * derivation it is rather than left to be rediscovered. Every registered
   * parameter that is NOT eligible is refused by `validateCrit` before the
   * branch runs, so no input to `rejectUnknownCritical` distinguishes "reads the
   * column" from "asks whether the parameter is registered at all" — measured:
   * weakening the loop to the latter leaves the whole suite at its exact
   * baseline. The distinction is probed one level down, on the shared predicate
   * (`internal/header/is-crit-eligible.test.ts`), which is why that predicate
   * has a file of its own.
   *
   * ⚠ THIS TEST IS THE TRIPWIRE. The day a registered parameter is both
   * ineligible and absent from the IANA list — a second proprietary parameter,
   * or the `b64`/`ppt`/`svt` trim — it goes RED, and at that moment the weakened
   * loop becomes observable from this door and must be probed here too.
   */
  test("the read path cannot tell the column from a bare is-it-registered read", () => {
    const ineligible = HEADER_SPECS.map(headerJoseName).filter(
      (jose) => !isCritEligible(jose),
    );

    expect(ineligible.length).toBe(HEADER_SPECS.length - 1);

    for (const jose of ineligible) {
      expect(
        validateCrit({ crit: [jose], [jose]: "x" }),
        `${jose} is registered, ineligible and NOT refused as malformed — the eligibility branch is now reachable from this door and owes a probe`,
      ).not.toBeNull();
    }
  });

  test("namespaces both codes by the FORMAT, so a refusal names the wire it came from", () => {
    // The same implementation serves both wires; only the format tag and the
    // error class differ. That is the whole point — a hostile token cannot be
    // refused on one wire and accepted on the other.
    expect(() =>
      rejectUnknownCritical({
        header: header({ crit: ["ext"], ext: "x" }),
        format: "cwt",
        error: CwtError,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "cwt_unsupported_crit_param",
        data: { param: "ext" },
      }),
    );
  });
});
