import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { buildCoseHeaders } from "./build-cose-headers.js";

const build = (
  overrides: Partial<Parameters<typeof buildCoseHeaders>[0]> = {},
): ReturnType<typeof buildCoseHeaders> =>
  buildCoseHeaders({
    reserved: ["alg", "kid", "typ"],
    header: undefined,
    unprotected: undefined,
    proprietary: false,
    error: CoseError,
    ...overrides,
  });

/**
 * The COSE twin of `build-jose-header.test.ts`, and the four rules it enforces.
 * What is stated here is the rule the two builders SHARE — a parameter that emits
 * nothing is not a parameter — because that is the one a wire asymmetry hides in:
 * a bag refused on one encoding and accepted on the other is refused or accepted
 * by the presenter's choice of encoding, not by the deployment's policy.
 */
describe("buildCoseHeaders", () => {
  describe("a parameter that emits nothing is not a parameter", () => {
    test("an UNDEFINED reserved parameter is absent, not a refusal", () => {
      expect(() => build({ header: { alg: undefined } as never })).not.toThrow();
    });

    test("an EMPTY reserved parameter the registry prunes is absent, not a refusal", () => {
      // The JOSE twin answers identically (`build-jose-header.test.ts`), which is
      // the point: both bags are normalised before ANY rule runs, so the four
      // rules below and the JOSE reserved check see the same values the wire will.
      expect(() => build({ header: { alg: "" } as never })).not.toThrow();
      expect(() => build({ unprotected: { alg: "" } as never })).not.toThrow();
    });

    test("an empty parameter in BOTH buckets is not a duplicate", () => {
      // Rule 3 refuses a parameter COSE would have to carry twice. An empty `cty`
      // is carried nowhere, so there is no second copy to refuse.
      expect(() =>
        build({ header: { cty: "" }, unprotected: { cty: "" } }),
      ).not.toThrow();
    });

    test("an empty protected-only parameter is not a placement error", () => {
      // Rule 4 states where a parameter TRAVELS, and one that travels nowhere has
      // no bucket to be in the wrong one of.
      expect(() => build({ unprotected: { cty: "" } })).not.toThrow();
    });

    test("an empty crit list is neither emitted nor treated as a crit", () => {
      // RFC 7515 §4.1.11 and RFC 9052 §3.1 both forbid producing the empty list,
      // and aegis's own reader refuses one — so the parameter must not reach the
      // protected bucket at all.
      const { protectedEntries } = build({ header: { crit: [] } });

      expect(protectedEntries.has(2)).toBe(false);
    });

    test("an empty crit list in the UNPROTECTED bucket is not a placement error", () => {
      // Rule 2 refuses `crit` from the unauthenticated bucket because RFC 9052
      // §3.1 requires critical parameters to be integrity-protected. An empty
      // list is not a `crit` the same RFC would let anyone produce ("The array
      // MUST have at least one value in it"), so the prune takes it and there is
      // nothing left in that bucket to place wrongly. Nothing reaches the wire
      // either way; what changes is only whether a caller hears a refusal for a
      // parameter that was never going to travel.
      expect(() => build({ unprotected: { crit: [] } })).not.toThrow();
    });
  });

  describe("nothing that emits bytes stops being guarded", () => {
    test("a NON-empty parameter in both buckets is still a duplicate", () => {
      expect(() =>
        build({
          header: { cty: "application/json" },
          unprotected: { cty: "text/plain" },
        }),
      ).toThrow(/set in both header and unprotected/);
    });

    test("a NON-empty protected-only parameter is still refused from the unprotected bag", () => {
      expect(() => build({ unprotected: { cty: "application/json" } })).toThrow(
        expect.objectContaining({ code: "cose_unprotected_placement" }),
      );
    });

    test("a NON-empty reserved parameter is still refused from either bag", () => {
      expect(() => build({ header: { alg: "ES512" } as never })).toThrow(
        expect.objectContaining({ code: "cose_reserved_header" }),
      );
      expect(() => build({ unprotected: { kid: "attacker-key" } as never })).toThrow(
        expect.objectContaining({ code: "cose_reserved_header" }),
      );
    });

    test("crit is still refused from the unprotected bucket when it names something", () => {
      // RFC 9052 §3.1 requires critical parameters to be integrity-protected.
      expect(() => build({ unprotected: { crit: ["oid"] } })).toThrow(
        expect.objectContaining({ code: "cose_crit_unprotected" }),
      );
    });

    test("a crit-listed parameter placed unprotected is still refused", () => {
      expect(() =>
        build({ header: { crit: ["oid"] }, unprotected: { oid: "1.2.3.4" } }),
      ).toThrow(expect.objectContaining({ code: "cose_crit_param_unprotected" }));
    });

    /**
     * ⚠ RULE 2 ASKS AN OWN-KEY QUESTION, and `in` answers a different one: it walks
     * `Object.prototype`, so every one of these members "was" in a bucket the
     * caller never supplied. `{ crit: ["toString"] }` alone — no `unprotected` bag
     * anywhere — was refused as a crit-listed parameter that "cannot be
     * unprotected". `Object.hasOwn` is the only membership test this package uses
     * on a caller-influenced key.
     */
    test("a crit member named after an Object.prototype member is not 'unprotected'", () => {
      for (const member of ["toString", "constructor", "valueOf", "hasOwnProperty"]) {
        // The member is still refused — by the LABEL RESOLVER, which is the
        // accurate verdict for a member that is no COSE label at all — and NOT by
        // rule 2, which had it "placed in a bucket" the caller never supplied.
        expect(() => build({ header: { crit: [member] } })).toThrow(
          expect.objectContaining({ code: "header_no_cose_label" }),
        );

        // …and the normalisation that turned an absent bag into `{}` does not
        // resurrect rule 2 either: an own-key test on an empty object is the same
        // statement the old `unprotected &&` guard made, with nothing to keep in
        // step. A REAL unprotected bag beside it changes nothing.
        expect(() =>
          build({
            header: { crit: [member] },
            unprotected: { iv: Buffer.from("iv-bytes") } as never,
          }),
        ).toThrow(expect.objectContaining({ code: "header_no_cose_label" }));
      }
    });

    /**
     * ⚠ AND A CRIT THIS FUNCTION CANNOT ANSWER IS NOT REFUSED HERE. Whether the
     * protected bucket provides the parameter is a question about the FINISHED
     * bucket, which this function does not hold — `alg`/`typ`/`cty` are written by
     * `mergeCoseProtected`, and the refusal lives at the end of it
     * (`merge-cose-protected.test.ts`). Asked here, on the caller's fragment, it
     * refused `crit: ["alg"]` on a message whose protected bucket carries `alg`.
     *
     * These three rows are the shapes that used to refuse here; they still refuse,
     * one step later, which the kit-level matrix in `assert-crit-satisfied.test.ts`
     * pins on both wires at once.
     */
    test("a crit the CALLER'S BAG alone cannot answer passes this stage", () => {
      expect(() =>
        build({ header: { crit: ["oid"] }, unprotected: { oid: "" } }),
      ).not.toThrow();
      expect(() => build({ header: { crit: ["oid"], oid: "" } })).not.toThrow();
      expect(() => build({ header: { crit: ["alg"] } as never })).not.toThrow();
    });

    test("a crit-listed parameter the message DOES provide is emitted", () => {
      // The other side of the rule, and the one that keeps the refusal honest: a
      // `crit` with a real value behind it reaches the protected bucket intact.
      const { protectedEntries } = build({ header: { crit: ["oid"], oid: "1.2.3.4" } });

      expect(protectedEntries.get(2)).toEqual(["oid"]);
      expect(protectedEntries.get("oid")).toBe("1.2.3.4");
    });

    /**
     * ⚠ ONE VOCABULARY, and this is the COSE half of it: `critToCoseLabels` takes
     * every member to the LABEL its parameter is keyed under (RFC 9052 §1.5 —
     * `label = int / tstr`), which is what lets the satisfaction check downstream
     * compare members against the protected map's keys without translating either.
     *
     * ⚠ A DOMAIN-spelled member therefore does not reach that check at all on this
     * door: `objectId` is no COSE label, so the resolver refuses it here. That is
     * the standing JOSE/COSE asymmetry — the JOSE wire door maps the same member to
     * `oid` and mints — and it is recorded rather than fixed. The DOMAIN door is
     * unaffected on both wires: `mapTokenHeader` runs `criticalToWire` at the
     * crossing, so `critical: ["objectId"]` arrives here already spelled `oid`.
     */
    test("a DOMAIN-spelled crit member is refused: it is no COSE label", () => {
      expect(() => build({ header: { crit: ["objectId"], oid: "1.2.3.4" } })).toThrow(
        expect.objectContaining({ code: "header_no_cose_label" }),
      );
    });
  });
});
