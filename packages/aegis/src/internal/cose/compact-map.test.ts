import { describe, expect, test } from "vitest";
import { compactDecode, compactEncode } from "./compact-map.js";

/**
 * `compactDecode` DISPOSES OF THE TWO KEY FORMS DIFFERENTLY, and each half is
 * pinned here: an unnamed INTEGER key is dropped, a STRING key rides back.
 *
 * ⚠ Fabricating a name for the integer arm (`reverse.get(key) ?? String(key)`)
 * would not stop here — it flows on as a MEMBER NAME into the translator's open
 * tail (`internal/claims/translate.ts`'s `open: "verbatim"` arm), so the claim
 * reports a member named after a label from a registry this deployment cannot
 * read, as though a producer had written it.
 *
 * ⚠ UNIT assertions over hand-written specs on purpose: every real `CompactSpec`
 * is DERIVED from the claim registry (`compact-spec-from-members.ts`), so no
 * registered claim can produce a label the table does not name.
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
    // A label from another deployment's registry: there is no name to report it
    // under, and the string form of the integer is a member no specification names.
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
    // ⛔ A text key that IS a declared name, which the `"email"` row below does not
    // cover. The integer `2` and the text `"sub"` are different map keys
    // (RFC 9052 §1.5) but two renderings of the SAME declared member, so a map
    // carrying both states two values for one field.
    //
    // ⚠ BOTH orders: on a raw-CBOR forgery either key can arrive last, and a
    // refusal that depended on arrival order would be no refusal.
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
    // Why the two dispositions differ: a text label is self-describing, so the
    // producer's own name for the member survives. RFC 9052 §1.5.
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

  test("CARRIES a `__proto__` text key as an OWN member, forging no labelled one", () => {
    // ⛔ A text key is the PRODUCER's, `__proto__` included (RFC 9052 §1.5).
    // Written by assignment rather than `Object.defineProperty` it invokes
    // `Object.prototype`'s setter, so no own key is created and the decoded
    // structure's PROTOTYPE is the producer's object instead. `isObject` decides
    // by prototype, so `walkObject`'s first guard (`internal/claims/translate.ts`)
    // then refuses the WHOLE claim as `Claim "…" must be an object` — the member
    // the producer wrote never arrives and the token is rejected rather than read.
    //
    // ⚠ ASSERT ON THE PROPERTY, never `toMatchSnapshot`/`toEqual` here: a swapped
    // prototype serialises as ABSENT, so both read clean on exactly this input.
    const decoded = compactDecode(
      new Map<number | string, unknown>([
        [1, "https://issuer.lindorm.test"],
        ["__proto__", { sub: "rogue-actor" }],
      ]),
      SPEC,
    ) as Record<string, unknown>;

    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(decoded.sub).toBeUndefined();

    // CARRIED, not refused — an unlabelled text key rides back under its own
    // spelling, `__proto__` included, as the `"email"` row above states.
    expect(Object.keys(decoded)).toContain("__proto__");
    expect(Object.getOwnPropertyDescriptor(decoded, "__proto__")?.value).toEqual({
      sub: "rogue-actor",
    });

    // The labelled member the map DID state is untouched, so the row cannot pass
    // by the decode having dropped everything.
    expect(decoded.iss).toBe("https://issuer.lindorm.test");
  });

  test("an unlabelled member survives a round trip under its string key", () => {
    // The pair, so the two functions are held to one another.
    expect(
      compactDecode(compactEncode({ sub: "actor", email: "a@b.test" }, SPEC), SPEC),
    ).toEqual({ sub: "actor", email: "a@b.test" });
  });
});
