import { describe, expect, test } from "vitest";
import { compactDecode, compactEncode } from "./compact-map.js";

/**
 * THE TWO HALVES OF ONE SENTENCE THE SOURCE STATES, ASSERTED SEPARATELY.
 *
 * `compactDecode`'s rule is: *"An INTEGER key the table does not name is the one
 * thing still dropped: it is a label from a registry this deployment does not
 * hold, and there is no name to report it under. A STRING key is self-describing
 * and rides back."* Two dispositions, two reasons — and only the string half was
 * pinned, through the claim-level wire tests. Measured: rewriting the integer arm
 * to fabricate a name (`reverse.get(key) ?? String(key)`) left the whole suite
 * green.
 *
 * ⚠ IT IS NOT A COSMETIC GAP. The fabricated `"99"` would not stop at this
 * function: it flows on as a MEMBER NAME into the translator's open tail
 * (`internal/claims/translate.ts`'s `open: "verbatim"` arm carries an undeclared
 * member untouched), so the claim would report a member named after an integer
 * label chosen by a registry this deployment cannot read — a name no specification
 * gave it, presented as though a producer had written it.
 *
 * ⚠ These are UNIT assertions over hand-written specs, deliberately. Every real
 * `CompactSpec` is DERIVED from the claim registry
 * (`compact-spec-from-members.ts`), so no registered claim can produce a label the
 * table does not name — the disposal is unreachable from the registry side and a
 * test driven through a claim could not state it at all.
 */

/** A two-member table, the shape an actor's compact map takes. */
const SPEC = { claim: "act", labels: { sub: 2, iss: 1 } } as const;

describe("compactDecode", () => {
  test("resolves a labelled member through the table", () => {
    expect(
      compactDecode(
        new Map<number | string, unknown>([
          [2, "actor"],
          [1, "https://issuer.lindorm.test"],
        ]),
        SPEC,
      ),
    ).toEqual({ sub: "actor", iss: "https://issuer.lindorm.test" });
  });

  test("DROPS an integer label the table does not name", () => {
    // A label from another deployment's registry. There is no name to report it
    // under, and inventing one — the string form of the integer — would put a
    // member on the claim that no specification ever defined.
    expect(
      compactDecode(
        new Map<number | string, unknown>([
          [2, "actor"],
          [99, "from-another-registry"],
        ]),
        SPEC,
      ),
    ).toEqual({ sub: "actor" });
  });

  test("REFUSES a string key that names a member the map already keyed by label", () => {
    // ⛔⛔ THE CASE THIS FILE DID NOT HAVE, and its absence is what let a live
    // fail-open through. The row below pins a text key that is NOT a declared
    // name (`"email"`), which exercises the carry; nothing exercised a text key
    // that IS one. RFC 9052 §1.5 makes the integer `2` and the text `"sub"`
    // different map keys, but they are two renderings of the SAME declared
    // member, so a map carrying both states two values for one field.
    //
    // ⚠ BOTH ORDERS, because on a raw-CBOR forgery either key can arrive last —
    // only a canonically-encoded map normalises that away — and a refusal that
    // depended on arrival order would be no refusal at all.
    for (const entries of [
      [
        [2, "audited-service"],
        ["sub", "rogue-service"],
      ],
      [
        ["sub", "rogue-service"],
        [2, "audited-service"],
      ],
    ] as Array<Array<[number | string, unknown]>>) {
      expect(() =>
        compactDecode(new Map<number | string, unknown>(entries), SPEC),
      ).toThrow(
        expect.objectContaining({
          code: "cose_duplicate_member_key",
          data: { claim: "act", member: "sub", label: 2, key: "sub" },
        }) as unknown as Error,
      );
    }
  });

  test("KEEPS a string key the table does not name, under its own spelling", () => {
    // The other half of the same sentence, and the reason the two dispositions
    // differ: a text label is self-describing, so the producer's own name for the
    // member survives. RFC 9052 §1.5 admits both key forms
    // (`label = int / tstr`), which is what makes a mixed map legal at all.
    expect(
      compactDecode(
        new Map<number | string, unknown>([
          [2, "actor"],
          ["email", "actor@lindorm.test"],
        ]),
        SPEC,
      ),
    ).toEqual({ sub: "actor", email: "actor@lindorm.test" });
  });

  test("an unlabelled member survives a round trip under its string key", () => {
    // The pair, so the two functions are held to one another: what `compactEncode`
    // writes under a string key is what `compactDecode` reads back.
    expect(
      compactDecode(compactEncode({ sub: "actor", email: "a@b.test" }, SPEC), SPEC),
    ).toEqual({ sub: "actor", email: "a@b.test" });
  });
});
