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
import { assertCritSatisfied } from "./assert-crit-satisfied.js";

const logger = createMockLogger();

/**
 * ONE mint per wire, through the REAL public doors, because the defect this file
 * exists to keep out was a disagreement BETWEEN the doors: the JOSE builder asked
 * the question on the merged header and the COSE builder asked it on the caller's
 * fragment, so the same call minted on one encoding and was refused on the other.
 * A unit test of either builder alone cannot see that.
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
  // `dir` — a COSE_Encrypt0 has no recipient structure to carry a wrapped key in,
  // so the CWE kit takes a direct symmetric key (`cose_key_management_unsupported`
  // otherwise). The JWE twin is the one that can take the EC key.
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

describe("assertCritSatisfied", () => {
  describe("the bucket is read STRUCTURALLY, never through the prototype chain", () => {
    /**
     * ⚠ `crit: ["toString"]` is the shape that got through twice. A member is
     * CALLER-CONTROLLED, so a membership test spelled `name in header` — or a
     * lookup spelled `header[name]` on a plain object — resolves through
     * `Object.prototype` and finds a function `isEmpty` calls non-empty. aegis
     * then minted a `crit` naming a parameter no header carries: a token RFC 7515
     * §4.1.11 and RFC 9052 §3.1 both make fatal for every recipient. The bucket is
     * a `Map` for exactly this reason — there is no chain to walk.
     *
     * ⚠ The two wires refuse it under different NAMES, and that is the standing
     * asymmetry rather than this defect: a COSE `crit` member is a LABEL (RFC 9052
     * §1.5), so a member the registry does not know is refused by the label
     * resolver (`header_no_cose_label`) before it can be looked up at all. Neither
     * wire mints; what mattered is that neither wire mints.
     */
    test.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"])(
      "a crit naming the Object.prototype member %s is refused on every wire",
      (member) => {
        for (const format of ["jws", "jwt", "jwe"]) {
          expect(verdict(format, { crit: [member] })).toBe(`${format}_invalid_crit`);
        }

        for (const format of ["cws", "cwt", "cwm", "cwe"]) {
          expect(verdict(format, { crit: [member] })).toBe("header_no_cose_label");
        }
      },
    );

    /**
     * The DIRECT-call contract, which the rows above cannot state: they mint
     * through the kit doors, so the COSE half never reaches this function at all
     * (the label resolver refuses an unknown member first) and the JOSE half
     * proves the composed verdict rather than this lookup.
     *
     * BOTH directions, because either alone is satisfied by an implementation
     * that is wrong in the other: an OWN key must SATISFY the member, and an
     * `Object.prototype` member must NOT. A version that resolves the member on a
     * plain object passes the first and fails the second; one that throws on
     * every member passes the second and fails the first.
     */
    test("an own key satisfies a crit member", () => {
      const bucket = new Map<string, unknown>(
        Object.entries({ crit: ["oid"], oid: "1.2.3.4" }),
      );

      expect(() =>
        assertCritSatisfied({
          bucket,
          critKey: "crit",
          format: "jws",
          error: AegisError,
        }),
      ).not.toThrow();
    });

    test("an Object.prototype member does not satisfy a crit member", () => {
      const bucket = new Map<string, unknown>(Object.entries({ crit: ["toString"] }));

      expect(() =>
        assertCritSatisfied({
          bucket,
          critKey: "crit",
          format: "jws",
          error: AegisError,
        }),
      ).toThrow(AegisError);
    });
  });

  /**
   * ⚠ THE SAME CALL, THE SAME VERDICT. `alg`, `typ` and `cty` are written by the
   * kit, into the JOSE header and into the COSE PROTECTED bucket alike, so a
   * `crit` naming one of them is satisfied on both wires — it was refused on COSE
   * alone for as long as the question was asked on the caller's fragment. A
   * refusal a caller can dodge by choosing an encoding is not a policy.
   *
   * ⚠⚠ These headers still do not VERIFY: RFC 7515 §4.1.11 forbids `crit` naming a
   * registered parameter, and `validate-crit.ts` refuses them on arrival. Minting
   * what aegis will not verify is a separate, pre-existing gap; this pins only
   * that the two wires answer the mint identically.
   */
  describe("a crit naming a KIT-DERIVED protected parameter agrees across the wires", () => {
    test.each(["alg", "typ"])("crit: [%s] mints on every wire", (member) => {
      for (const format of Object.keys(MINTERS)) {
        expect(verdict(format, { crit: [member] })).toBe("MINTS");
      }
    });

    // `cty` is derived by the OPAQUE and ENCRYPTED wires (the codec infers a media
    // type for the payload) and by neither claims wire — RFC 8392 §7.2 reads a CWT
    // payload as a CBOR map with no cty-driven decode, and RFC 7519 §5.2 leaves
    // `cty` for nested JWTs only. So the verdict pairs by WIRE PAIR, not by
    // encoding, which is the same rule reading a different bucket.
    test("crit: [cty] mints where a cty is derived and is refused where none is", () => {
      for (const format of ["jws", "jwe", "cws", "cwe"]) {
        expect(verdict(format, { crit: ["cty"] })).toBe("MINTS");
      }

      for (const format of ["jwt", "cwt", "cwm"]) {
        expect(verdict(format, { crit: ["cty"] })).toBe(`${format}_invalid_crit`);
      }
    });

    /**
     * ⚠ `kid` is the ONE member the wires answer differently, and it is a fact
     * about the STRUCTURES rather than about this check. RFC 7515 §7.1 gives the
     * JOSE compact serialisation ONE header and `kid` is in it; RFC 9052 §3.1 puts
     * the COSE `kid` in the UNPROTECTED bucket ("not a security-critical field"),
     * and the same section makes a `crit` naming a label that is not in the
     * protected bucket "a fatal error in processing the message". Minting it on
     * COSE would mint a token no conformant COSE reader accepts, so the COSE half
     * refuses — naming the LABEL, which is what a COSE `crit` list contains.
     */
    test("crit: [kid] mints on JOSE and is refused on COSE", () => {
      for (const format of ["jws", "jwt", "jwe"]) {
        expect(verdict(format, { crit: ["kid"] })).toBe("MINTS");
      }

      for (const format of ["cws", "cwt", "cwm", "cwe"]) {
        expect(verdict(format, { crit: ["kid"] })).toBe(`${format}_invalid_crit`);
      }
    });
  });

  describe("a satisfied crit still mints, and an unsatisfied one still refuses", () => {
    // `oid` is the one parameter aegis owns that RFC 7515 §4.1.11 permits a `crit`
    // to name at all — every other one is IANA-registered — so it is the member
    // that reaches the decision rather than agreeing with it by accident.
    test("crit: [oid] beside a real oid mints on every wire", () => {
      for (const format of Object.keys(MINTERS)) {
        expect(verdict(format, { crit: ["oid"], oid: "1.2.3.4" })).toBe("MINTS");
      }
    });

    test.each([{ oid: "" }, { oid: undefined }, { oid: null }, {}])(
      "crit: [oid] with %s is refused on every wire",
      (rest) => {
        for (const format of Object.keys(MINTERS)) {
          expect(verdict(format, { crit: ["oid"], ...rest } as WireProtectedHeader)).toBe(
            `${format}_invalid_crit`,
          );
        }
      },
    );
  });

  /**
   * The `format` tag feeds the error CODE and nothing else, so a tag threaded to
   * the wrong kit is silent unless something reads it per kit. The rows above
   * assert the code by construction; this one states the seven strings outright,
   * so a kit wired to a neighbour's tag reddens with the two names in the diff.
   */
  test("every kit namespaces the refusal with ITS OWN format tag", () => {
    expect(
      Object.keys(MINTERS).map((format) => verdict(format, { crit: ["oid"] })),
    ).toMatchSnapshot();
  });
});
