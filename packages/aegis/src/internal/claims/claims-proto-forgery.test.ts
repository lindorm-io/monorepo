import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { decodeCwtClaims } from "../cose/cwt-claims.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

/**
 * A claims dict carrying `__proto__` as an OWN property — the shape `JSON.parse`
 * produces and an object literal cannot. A service builds its claims from parsed
 * input, and the WIRE doors take an already-wire dict VERBATIM (no case
 * conversion), so this is the realistic arrival path.
 */
const forged = (): Record<string, unknown> =>
  JSON.parse(
    '{"iss":"https://good.example/","sub":"u1","__proto__":{"cti":"forged-token-id","aud":"https://victim.example/"}}',
  ) as Record<string, unknown>;

/**
 * ⛔⛔ AN ISSUER MUST NOT BE ABLE TO SIGN A CLAIM IT NEVER STATED.
 *
 * `normaliseClaims` is `pruneEmptyClaims(omitUndefined(dict))`. `omitFromObject`
 * deliberately PRESERVES an own `__proto__` (`omit-from-object.ts:32`), so it
 * reaches the prune live — and a plain `result[key] = value` there makes it the
 * result's PROTOTYPE. The COSE claims codec then reads registered claims off that
 * bag BY PROPERTY, so every inherited member is encoded as though the issuer had
 * written it.
 *
 * ⚠ `aud` IS THE ONE THAT MATTERS. RFC 7519 §4.1.3 makes it the claim by which an
 * issuer names who a token is for, and every relying party checks it — so a
 * forged one is a token minted for an audience the issuer never addressed, over
 * a real signature.
 */
describe("a `__proto__` claim key cannot forge a signed claim", () => {
  test.each([
    [
      "cwt",
      () =>
        CwtKit.decode(
          new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(forged() as never),
        ).payload,
    ],
    [
      "jwt",
      () =>
        JwtKit.decode(
          new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(forged() as never),
        ).payload,
    ],
  ] as const)(
    "%s: no claim the issuer did not state reaches the signed payload",
    (_, mint) => {
      const payload = mint() as Record<string, unknown>;

      // MEASURED before the repair, through this exact door: the COSE payload came
      // back `{iss, sub, aud:"https://victim.example/", cti:"forged-token-id"}`.
      expect(payload.aud).toBeUndefined();
      expect(payload.cti).toBeUndefined();

      // The claims the issuer DID state are untouched — so the row cannot pass by
      // the mint having dropped everything.
      expect(payload.iss).toBe("https://good.example/");
      expect(payload.sub).toBe("u1");
    },
  );

  /**
   * ⭐ THE READ SIDE, on a map no aegis writer produces. A FOREIGN CWT may key a
   * claim by the text label `__proto__`, and the registered claims are read off
   * the decoded object BY PROPERTY — so were that member to become the object's
   * prototype, `aud` would answer with the producer's value on a token whose
   * signature verifies.
   *
   * ⚠ THE DISPOSAL IS IN `@lindorm/cbor`, not in this package: `decode-cbor-map.ts`
   * writes every `lax` member with `Object.defineProperty`.
   *
   * ⛔ THIS ROW NOTICES A REGRESSION THERE ONLY AFTER `@lindorm/cbor` IS REBUILT —
   * aegis resolves that package to its `dist`, so editing `packages/cbor/src` and
   * running `cd packages/aegis && npm test` proves nothing. It bites in CI because
   * `.github/workflows/pull-request.yml` runs `npm run build` before `test:unit`.
   * Verified by reverting the disposal, rebuilding cbor, and watching this row and
   * the mint rows above go red together.
   *
   * ⚠ ASSERT ON THE PROPERTY. A swapped prototype serialises as absent, so
   * `JSON.stringify`/`toEqual` reads clean on exactly the hostile input.
   */
  test("a foreign CWT keying a claim `__proto__` forges nothing on READ", () => {
    const decoded = decodeCwtClaims(
      new Map<number | string, unknown>([
        [1, "https://good.example/"],
        ["__proto__", { aud: "https://victim.example/", cti: "forged" }],
      ]),
    ) as Record<string, unknown>;

    expect(decoded.aud).toBeUndefined();
    expect(decoded.cti).toBeUndefined();
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    // CARRIED, not dropped — a read reports what a producer wrote.
    expect(Object.keys(decoded)).toContain("__proto__");
    expect(decoded.iss).toBe("https://good.example/");
  });

  test("and nothing in the process is polluted", () => {
    new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(forged() as never);

    expect(({} as Record<string, unknown>).aud).toBeUndefined();
  });
});
