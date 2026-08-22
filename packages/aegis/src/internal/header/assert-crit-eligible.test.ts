import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { CweKit } from "../../classes/CweKit.js";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisError } from "../../errors/index.js";
import type { WireProtectedHeader } from "../../types/index.js";
import { assertCritEligible } from "./assert-crit-eligible.js";

const logger = createMockLogger();

/**
 * ONE mint per wire, through the REAL public doors — the same harness
 * `assert-crit-satisfied.test.ts` uses, and for the same reason: the thing this
 * gate has to get right is that the SEVEN doors answer one call identically.
 * Before it, `crit: ["alg"]` minted on every wire, `crit: ["objectId"]` minted on
 * JOSE and threw a label-resolution error on COSE, and `crit: ["ext"]` produced a
 * third pair of verdicts. A unit test of either builder alone cannot see that.
 */
const MINTERS: Record<string, (header: WireProtectedHeader) => unknown> = {
  jws: (header) =>
    new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign("data", { header }),
  jwt: (header) =>
    new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(
      { iss: "https://test.lindorm.io/", sub: "user-1" },
      { header },
    ),
  jwe: (header) =>
    new JweKit({ logger, kryptos: TEST_EC_KEY_ENC }).encrypt("data", { header }),
  cws: (header) =>
    new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(Buffer.from("data"), {
      header,
    }),
  cwt: (header) =>
    new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(
      { iss: "https://test.lindorm.io/", sub: "user-1" },
      { header },
    ),
  cwm: (header) =>
    new CwmKit({ logger, kryptos: TEST_OCT_KEY_SIG }).sign(
      { iss: "https://test.lindorm.io/", sub: "user-1" },
      { header },
    ),
  cwe: (header) =>
    new CweKit({ logger, kryptos: TEST_OCT_KEY_ENC }).encrypt("data", { header }),
};

/** MINTS, or the `code` of the refusal — the verdict, comparable across wires. */
const verdict = (format: string, header: WireProtectedHeader): string => {
  try {
    MINTERS[format](header);
    return "MINTS";
  } catch (error: unknown) {
    return String((error as AegisError).code);
  }
};

describe("assertCritEligible", () => {
  describe("through the seven public mint doors", () => {
    /**
     * Every one of these is a specification-defined name (RFC 7515 §4.1.11), so a
     * `crit` naming one mints a token malformed for every recipient — including
     * aegis's own verify, which refuses it as `*_invalid_crit`. A library that mints
     * what it will not verify has two answers to one question.
     *
     * ⚠ `kid` and `cty` are the members a BUCKET-READING refusal answers differently
     * per wire: `cty` is derived by the opaque and encrypted wires and by neither
     * claims wire, and `kid` is protected on JOSE and unprotected on COSE.
     * Eligibility reads no bucket, so the name is forbidden whatever a bucket holds.
     */
    test.each(["alg", "typ", "cty", "kid", "crit", "x5t", "enc"])(
      "a specification-defined parameter (%s) cannot be marked critical on any wire",
      (member) => {
        for (const format of Object.keys(MINTERS)) {
          expect(verdict(format, { crit: [member] } as WireProtectedHeader)).toBe(
            `${format}_crit_param_not_permitted`,
          );
        }
      },
    );

    test("a parameter aegis does not implement cannot be marked critical on any wire", () => {
      // The other half of the gate, and the reason it is not simply "the IANA
      // list, inverted": a name aegis has never heard of is not a critical
      // extension aegis implements either, so it is refused by the same cell
      // rather than by a second rule.
      for (const format of Object.keys(MINTERS)) {
        expect(
          verdict(format, { crit: ["ext"], ext: "x" } as unknown as WireProtectedHeader),
        ).toBe(`${format}_crit_param_not_permitted`);
      }
    });

    /**
     * ⚠ THE DOORS TAKE ONE VOCABULARY, and a `crit` MEMBER is a parameter name
     * like any other. The wire doors take wire names — that is what makes
     * `aegis.jws.sign` and `aegis.cws.sign` the same call in two encodings — so
     * the DOMAIN spelling is refused there. Before the gate this was the standing
     * JOSE/COSE asymmetry: `shapeWireHeader` remapped the member on JOSE and the
     * token minted, while the COSE label resolver refused it. One call, two
     * verdicts, chosen by encoding.
     *
     * The DOMAIN door is unaffected and still translates — `mapTokenHeader` runs
     * `criticalToWire` at the crossing, so `critical: ["objectId"]` reaches a
     * builder already spelled `oid`.
     */
    test("a DOMAIN-spelled member is refused at a WIRE door on every wire", () => {
      for (const format of Object.keys(MINTERS)) {
        expect(
          verdict(format, { crit: ["objectId"], oid: "1.2.3.4" } as WireProtectedHeader),
        ).toBe(`${format}_crit_param_not_permitted`);
      }
    });

    /**
     * RFC 7515 §4.1.11's SECOND producer prohibition.
     *
     * ⚠ It needs a GATE rather than a note: without one a duplicate round-trips
     * cleanly — minting, and verifying for a recipient that declares the member,
     * reporting `["oid","oid"]` — while staying malformed for every conformant
     * third party. A token correct to its own issuer and refusable by everyone else
     * is the mint/verify asymmetry with the outside world this file removes.
     */
    test("a duplicate member is refused on every wire", () => {
      for (const format of Object.keys(MINTERS)) {
        expect(verdict(format, { crit: ["oid", "oid"], oid: "1.2.3.4" })).toBe(
          `${format}_invalid_crit`,
        );
      }
    });

    test("an INELIGIBLE name repeated is refused for being ineligible, not for repeating", () => {
      // Order matters and this pins it: `crit: ["alg","alg"]` breaks two
      // prohibitions at once, and the accurate verdict is the one about the NAME
      // — a producer must stop naming `alg` at all, not merely stop naming it
      // twice. Reporting the duplicate would send the caller to the wrong repair.
      for (const format of Object.keys(MINTERS)) {
        expect(verdict(format, { crit: ["alg", "alg"] } as WireProtectedHeader)).toBe(
          `${format}_crit_param_not_permitted`,
        );
      }
    });

    test("the one eligible parameter still mints on every wire", () => {
      // The control. Without it every row above is satisfied by a gate that
      // refuses every `crit` there is, which is the state this step replaced.
      for (const format of Object.keys(MINTERS)) {
        expect(verdict(format, { crit: ["oid"], oid: "1.2.3.4" })).toBe("MINTS");
      }
    });

    /**
     * ⚠ THE SATISFACTION CHECK STILL RUNS, and it has to: eligibility asks
     * whether the NAME may stand, satisfaction asks whether the bucket carries a
     * VALUE for it. `oid` passes the first and fails the second here, which is
     * what proves the gate did not swallow the check downstream of it.
     */
    test("an eligible parameter with no value is still refused by the satisfaction check", () => {
      for (const format of Object.keys(MINTERS)) {
        expect(verdict(format, { crit: ["oid"] })).toBe(`${format}_invalid_crit`);
      }
    });
  });

  /**
   * The DIRECT-call contract. ⚠ `crit`'s members are CALLER-CONTROLLED, so the
   * lookup must be an OWN-key one: `headerByJose` is a `Map` read, which has no
   * prototype chain to walk. A plain-object registry would answer for
   * `"toString"` and hand back a function, and `fn?.critEligible === true` would
   * be false — so the refusal survives by accident there rather than by design,
   * which is exactly how this class of hole reopens.
   */
  test.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"])(
    "an Object.prototype member (%s) is not eligible",
    (member) => {
      expect(() =>
        assertCritEligible({
          header: { crit: [member] },
          custom: new Set<string>(),
          format: "jws",
          error: AegisError,
        }),
      ).toThrow(expect.objectContaining({ code: "jws_crit_param_not_permitted" }));
    },
  );

  test("a non-string member is not eligible", () => {
    expect(() =>
      assertCritEligible({
        header: { crit: [1] },
        custom: new Set<string>(),
        format: "jws",
        error: AegisError,
      }),
    ).toThrow(expect.objectContaining({ code: "jws_crit_param_not_permitted" }));
  });

  test("a header with no crit at all is left alone", () => {
    expect(() =>
      assertCritEligible({
        header: { oid: "1.2.3.4" },
        custom: new Set<string>(),
        format: "jws",
        error: AegisError,
      }),
    ).not.toThrow();
  });

  test("a non-array crit is left to the checks written for it", () => {
    // Malformedness is `validate-crit.ts`'s question on the read and the codec
    // guard's on the write; this gate answers eligibility and nothing else, so a
    // shape it cannot iterate is passed on rather than given a second verdict.
    expect(() =>
      assertCritEligible({
        header: { crit: "oid" },
        custom: new Set<string>(),
        format: "jws",
        error: AegisError,
      }),
    ).not.toThrow();
  });

  test("the duplicate refusal names the repeated member and the whole list", () => {
    expect(() =>
      assertCritEligible({
        header: { crit: ["oid", "oid"], oid: "1.2.3.4" },
        custom: new Set<string>(),
        format: "cwt",
        error: AegisError,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "cwt_invalid_crit",
        // ⚠ The LIST is in `data` and it is what makes this verdict specific:
        // `assertCritSatisfied` throws the same class and code with the same
        // `{ crit, parameter }` shape for the OTHER malformed-crit fault, and the
        // duplicated list is the evidence that tells the two apart.
        data: { crit: ["oid", "oid"], parameter: "oid" },
      }),
    );
  });

  test("the refusal names the member and the whole list", () => {
    expect(() =>
      assertCritEligible({
        header: { crit: ["oid", "alg"] },
        custom: new Set<string>(),
        format: "cwt",
        error: AegisError,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "cwt_crit_param_not_permitted",
        // The FIRST non-eligible member, not the first member: `oid` is eligible
        // and is skipped, so the report names the one that actually failed.
        data: { crit: ["oid", "alg"], parameter: "alg" },
      }),
    );
  });
});
