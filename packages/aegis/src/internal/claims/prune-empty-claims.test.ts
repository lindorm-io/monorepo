import { describe, expect, test } from "vitest";
import { pruneEmptyClaims } from "./prune-empty-claims.js";

/**
 * The claims-side emission prune — the payload twin of
 * `internal/header/prune-empty-headers.ts`.
 */
describe("pruneEmptyClaims", () => {
  test("a REGISTERED claim the registry prunes is dropped when its value is empty", () => {
    // `sub` declares `whenEmpty: "prune"`; an empty subject states nothing.
    expect(pruneEmptyClaims({ iss: "https://i/", sub: "" })).toEqual({
      iss: "https://i/",
    });
  });

  test("a REGISTERED claim with a real value survives", () => {
    expect(pruneEmptyClaims({ iss: "https://i/", sub: "u1" })).toEqual({
      iss: "https://i/",
      sub: "u1",
    });
  });

  test("an UNREGISTERED key is never pruned, however empty", () => {
    // aegis does not reshape what it has not declared — which is what keeps the
    // opaque and raw kit-sign doors honest.
    expect(pruneEmptyClaims({ mine: "", other: [] })).toEqual({ mine: "", other: [] });
  });

  test("both wire vocabularies resolve", () => {
    // RFC 8392 renames `jti` to `cti` on the COSE wire; `signCwt` hands this a
    // cose-keyed dict, `JwtKit.sign` a jose-keyed one.
    expect(pruneEmptyClaims({ cti: "", jti: "" })).toEqual({});
  });

  /**
   * ⛔⛔ THE KEYS ARE THE CALLER'S, and a WIRE door takes an already-wire dict
   * VERBATIM — no case conversion — so a service that built its claims with
   * `JSON.parse` hands an own `__proto__` straight here. `@lindorm/utils`'s
   * `omitFromObject` runs first and deliberately PRESERVES it
   * (`omit-from-object.ts:32`), so it arrives live.
   *
   * ⚠ A PLAIN `result[key] = value` HERE FORGES A SIGNED CLAIM. The COSE claims
   * codec reads registered claims off this bag BY PROPERTY, so an inherited
   * `aud`/`cti` is encoded as though the issuer had stated it. The end-to-end
   * consequence is pinned in `claims-proto-forgery.test.ts`; this is the unit that
   * owns the mechanism.
   *
   * ⚠ ASSERT ON THE PROPERTY AND THE PROTOTYPE. `JSON.stringify` and
   * `Object.keys` both render a swapped prototype as ABSENT, so a check written
   * with either reports a forged bag as clean.
   */
  test("an own `__proto__` is carried as an own key and swaps no prototype", () => {
    const dict = JSON.parse(
      '{"iss":"https://good.example/","__proto__":{"aud":"https://victim.example/"}}',
    ) as Record<string, unknown>;

    const pruned = pruneEmptyClaims(dict);

    expect(Object.keys(pruned).sort()).toEqual(["__proto__", "iss"]);
    expect((pruned as Record<string, unknown>).aud).toBeUndefined();
    expect(Object.getPrototypeOf(pruned)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).aud).toBeUndefined();
  });
});
