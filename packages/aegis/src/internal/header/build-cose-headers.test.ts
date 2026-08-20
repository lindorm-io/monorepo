import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { buildCoseHeaders } from "./build-cose-headers.js";

const build = (
  overrides: Partial<Parameters<typeof buildCoseHeaders>[0]> = {},
): ReturnType<typeof buildCoseHeaders> =>
  buildCoseHeaders({
    reserved: ["alg", "kid", "typ"],
    header: undefined,
    custom: undefined,
    cert: undefined,
    proprietary: false,
    format: "cwt",
    error: CoseError,
    ...overrides,
  });

/**
 * The COSE twin of `build-jose-header.test.ts`, and the rules it enforces. What is
 * stated here is the rule the two builders SHARE — a parameter that emits nothing
 * is not a parameter — because that is the one a wire asymmetry hides in: a bag
 * refused on one encoding and accepted on the other is refused or accepted by the
 * presenter's choice of encoding, not by the deployment's policy.
 *
 * ⚠ ONLY THE `custom` BAGS CAN PUT ANYTHING IN THE UNPROTECTED BUCKET. A
 * registered parameter has no caller-chosen bucket — see the function's docstring
 * — so every unprotected row here states an UNREGISTERED key, and the rows that
 * once stated a registered one in `unprotected` now state the refusal that
 * replaced them (`header_registered_in_custom`).
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
    });

    test("a registered parameter emitting nothing is not a duplicate of a custom one", () => {
      // Rule 3 refuses a parameter COSE would have to carry twice. An empty `cty`
      // is carried nowhere, so there is no second copy to refuse.
      expect(() =>
        build({
          header: { cty: "" },
          custom: { unprotected: { "x-hint": "kept" } },
        }),
      ).not.toThrow();
    });

    test("an UNDEFINED custom parameter is absent, not an emission", () => {
      // The one normalisation a custom bag gets: an unregistered key has no
      // registry row, so there is no `whenEmpty` cell to consult and an EMPTY
      // value travels verbatim — only `undefined` is dropped
      // (`build-custom-header.ts`).
      const { protectedEntries } = build({
        custom: { protected: { "x-absent": undefined, "x-empty": "" } },
      });

      expect(protectedEntries.has("x-absent")).toBe(false);
      expect(protectedEntries.get("x-empty")).toBe("");
    });

    test("an empty crit list is neither emitted nor treated as a crit", () => {
      // RFC 7515 §4.1.11 and RFC 9052 §3.1 both forbid producing the empty list,
      // and aegis's own reader refuses one — so the parameter must not reach the
      // protected bucket at all.
      const { protectedEntries } = build({ header: { crit: [] } });

      expect(protectedEntries.has(2)).toBe(false);
    });

    test("an EMPTY crit list in the UNPROTECTED bucket is still refused", () => {
      // ⚠ THE PRUNE DOES NOT REACH THE CUSTOM BAGS, so unlike the protected `crit`
      // above, an empty one written into `custom.unprotected` is not normalised
      // away — and the refusal is right either way: RFC 9052 §3.1 requires
      // critical parameters to be integrity-protected, so `crit` has no business
      // in that bucket whatever its value.
      expect(() => build({ custom: { unprotected: { crit: [] } } })).toThrow(
        expect.objectContaining({ code: "cose_crit_unprotected" }),
      );
    });
  });

  describe("nothing that emits bytes stops being guarded", () => {
    test("the same CUSTOM key in both buckets is a duplicate", () => {
      // Rule 3 compares LABELS, and a custom parameter IS its own tstr label — so
      // the rule reaches the custom bags without knowing anything about them.
      expect(() =>
        build({
          custom: {
            protected: { "x-hint": "signed" },
            unprotected: { "x-hint": "unsigned" },
          },
        }),
      ).toThrow(/set in both header and unprotected/);
    });

    test("a REGISTERED name in either custom bag is refused", () => {
      // The rule that REPLACES the placement one: a registered parameter belongs
      // in `header`, where its value codec and its bucket placement apply, so it
      // is refused from `custom` in EITHER bucket rather than accepted into the
      // wrong one.
      for (const bucket of ["protected", "unprotected"] as const) {
        expect(() =>
          build({ custom: { [bucket]: { cty: "application/json" } } }),
        ).toThrow(
          expect.objectContaining({
            code: "header_registered_in_custom",
            data: { parameter: "cty", bucket },
          }),
        );
      }
    });

    test("a KIT-OWNED name in either custom bag is refused, and says so distinctly", () => {
      // A subset of the rule above, and the accurate verdict is the narrower one:
      // no caller bag accepts a kit-owned parameter, so "put it in `header`" would
      // send the caller to a bag whose type Omits it.
      for (const bucket of ["protected", "unprotected"] as const) {
        expect(() => build({ custom: { [bucket]: { kid: "attacker-key" } } })).toThrow(
          expect.objectContaining({
            code: "header_kit_owned_in_custom",
            data: { parameter: "kid", bucket },
          }),
        );
      }
    });

    test("a NON-empty reserved parameter is still refused from the header bag", () => {
      expect(() => build({ header: { alg: "ES512" } as never })).toThrow(
        expect.objectContaining({ code: "cose_reserved_header" }),
      );
    });

    test("crit is still refused from the unprotected bucket when it names something", () => {
      // RFC 9052 §3.1 requires critical parameters to be integrity-protected, and
      // that verdict is reported ahead of the registered-in-custom one: the wire's
      // own constraint outranks aegis's split policy.
      expect(() => build({ custom: { unprotected: { crit: ["oid"] } } })).toThrow(
        expect.objectContaining({ code: "cose_crit_unprotected" }),
      );
    });

    test("a crit-listed CUSTOM parameter placed unprotected is still refused", () => {
      expect(() =>
        build({
          header: { crit: ["x-hint"] },
          custom: {
            protected: { "x-hint": "signed" },
            unprotected: { "x-hint": "unsigned" },
          },
        }),
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
        // The member is still refused — now by the ELIGIBILITY gate, which runs
        // ahead of all four rules and is the accurate verdict for a member that
        // is no registered parameter at all — and NOT by rule 2, which had it
        // "placed in a bucket" the caller never supplied. (Before the gate the
        // refusal came one step later, from the label resolver.)
        expect(() => build({ header: { crit: [member] } })).toThrow(
          expect.objectContaining({ code: "cwt_crit_param_not_permitted" }),
        );

        // …and the normalisation that turned an absent bag into `{}` does not
        // resurrect rule 2 either: an own-key test on an empty object is the same
        // statement the old `unprotected &&` guard made, with nothing to keep in
        // step. A REAL unprotected bag beside it changes nothing.
        expect(() =>
          build({
            header: { crit: [member] },
            custom: { unprotected: { "x-hint": "unsigned" } },
          }),
        ).toThrow(expect.objectContaining({ code: "cwt_crit_param_not_permitted" }));
      }
    });

    /**
     * ⚠ AND A CRIT THIS FUNCTION CANNOT ANSWER IS NOT REFUSED HERE. Whether the
     * protected bucket provides the parameter is a question about the FINISHED
     * bucket, which this function does not hold — `alg`/`typ`/`cty` are written by
     * `mergeCoseProtected`, and the refusal lives at the end of it
     * (`merge-cose-protected.test.ts`).
     *
     * ⚠ The case that MOTIVATED the split — `crit: ["alg"]`, refused here on the
     * caller's fragment while the JOSE twin minted the same header — is now
     * closed one step FURTHER upstream, by the eligibility gate, and can no
     * longer occur (the row below states that refusal). What survives is these
     * two rows: an eligible member whose value is empty, or whose value the
     * caller put in the unprotected bag. Both are answered later, and the split
     * still earns its place because the reason for it is unchanged — a fragment
     * cannot answer a question about the message.
     */
    test("a crit the CALLER'S BAG alone cannot answer passes this stage", () => {
      expect(() => build({ header: { crit: ["oid"], oid: "" } })).not.toThrow();
    });

    /**
     * ⚠ `crit: ["alg"]` USED TO PASS THIS STAGE and now does not, and the reason
     * is a different question rather than a stricter answer to the same one.
     * Whether the FINISHED bucket carries a value for the member is still not
     * this function's question — `alg` is written by `mergeCoseProtected`, which
     * is where the satisfaction check lives. Whether the member may be named in
     * `crit` AT ALL is answerable here, on the caller's bag, and RFC 7515
     * §4.1.11 answers it: a producer must not name a specification-defined
     * parameter, whatever any bucket goes on to carry.
     */
    test("a crit naming a specification-defined parameter is refused at this stage", () => {
      expect(() => build({ header: { crit: ["alg"] } as never })).toThrow(
        expect.objectContaining({
          code: "cwt_crit_param_not_permitted",
          data: { crit: ["alg"], parameter: "alg" },
        }),
      );
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
     * ⚠ A DOMAIN-spelled member does not reach that translation at all: the
     * eligibility gate runs on the WIRE-NAMED bag first, and `objectId` is no
     * JOSE wire name, so it is refused before any label is resolved. That closes
     * the standing JOSE/COSE asymmetry this test used to record — the JOSE wire
     * door mapped the same member to `oid` and MINTED, while this one threw
     * `header_no_cose_label`. The DOMAIN door is unaffected on both wires:
     * `mapTokenHeader` runs `criticalToWire` at the crossing, so
     * `critical: ["objectId"]` arrives here already spelled `oid`.
     */
    test("a DOMAIN-spelled crit member is refused at a wire door", () => {
      expect(() => build({ header: { crit: ["objectId"], oid: "1.2.3.4" } })).toThrow(
        expect.objectContaining({
          code: "cwt_crit_param_not_permitted",
          data: { crit: ["objectId"], parameter: "objectId" },
        }),
      );
    });
  });
});
