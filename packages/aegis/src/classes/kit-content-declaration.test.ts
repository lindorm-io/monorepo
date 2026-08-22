import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { inspectToken, type CoseInspection } from "../__fixtures__/inspect-token.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import { CweKit } from "./CweKit.js";
import { CwmKit } from "./CwmKit.js";
import { CwsKit } from "./CwsKit.js";
import { CwtKit } from "./CwtKit.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

/** RFC 9052 §3.1, Table 3 — `cty` is label 3 on the COSE wire. */
const COSE_CTY = 3;

/**
 * WHICH KIT DECLARES A CONTENT TYPE, AND WHICH DOES NOT.
 *
 * A `cty` says what the secured payload IS. That is information on an OPAQUE
 * wire, where the payload can be anything, and it is a restatement of the format
 * on a CLAIMS wire, where the payload is a claim set by definition. Both
 * specifications say so: RFC 7519 §5.2, and RFC 8392 §7.2 — which drives no
 * cty-based decode at all, `cty` on a CWT marking NESTING instead
 * (RFC 8392 Appendix A.6).
 *
 * So the CLAIMS kits derive NO cty and the OPAQUE kits derive one from the value
 * they were handed. The rows below assert both halves TOGETHER, because either
 * alone would still pass if every kit did the same thing.
 *
 * ⚠ The claims kits must not disagree with each other about a payload carrying
 * the SAME domain claims. Deriving from what each signer is handed stamps a JWT
 * `application/json` and a CWT `application/octet-stream`, purely because the
 * COSE side hands its signer pre-encoded bytes — neither statement useful, and
 * one of them not even true of the wire it rides on.
 */
describe("which cty a kit declares", () => {
  const logger = createMockLogger();

  const claims: Dict = { iss: "https://test.lindorm.io/", sub: "user-1" };
  const dict: Dict = { hello: "world" };
  const text = "an opaque string payload";
  const bytes = Buffer.from([0xca, 0xfe, 0xba, 0xbe]);

  /** The JOSE protected header, read back with the independent wire inspector. */
  const joseHeader = (token: string): Dict => {
    const inspection = inspectToken(token);
    expect(inspection.wire).toBe("jose");
    return (inspection as { protectedHeader: Dict }).protectedHeader;
  };

  /** The COSE protected bucket of a `Buffer` token, same inspector. */
  const coseHeader = (token: Buffer): ReadonlyMap<unknown, unknown> => {
    const inspection = inspectToken(token.toString("base64url")) as CoseInspection;
    expect(inspection.wire).toBe("cose");
    return inspection.protectedHeader;
  };

  describe("a CLAIMS kit declares none", () => {
    test("JwtKit stamps NO cty", () => {
      const header = joseHeader(
        new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(claims),
      );

      expect(header).not.toHaveProperty("cty");
      // The control: the header IS there and IS populated, so the absence above
      // is an omitted parameter and not an unread header.
      expect(header.alg).toBe(TEST_EC_KEY_SIG.algorithm);
    });

    test("CwtKit (COSE_Sign1) stamps NO cty", () => {
      const header = coseHeader(
        new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(claims),
      );

      expect(header.has(COSE_CTY)).toBe(false);
      expect(header.size).toBeGreaterThan(0);
    });

    test("CwmKit (COSE_Mac0) stamps NO cty", () => {
      const header = coseHeader(
        new CwmKit({ kryptos: TEST_OCT_KEY_SIG, logger }).sign(claims),
      );

      expect(header.has(COSE_CTY)).toBe(false);
      expect(header.size).toBeGreaterThan(0);
    });
  });

  // `cty` is NOT reserved on any of the three claims wires, and that is what
  // makes the omission a DEFAULT rather than a prohibition: the parameter
  // declares a NESTED token (RFC 7519 §5.2, RFC 8392 Appendix A.6), so a
  // caller must be able to set it. A kit that merely dropped it would take the
  // nesting declaration away with the restatement.
  describe("a caller-set cty still WINS on a claims kit", () => {
    test("JwtKit carries the caller's label", () => {
      const token = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(claims, {
        header: { cty: "application/example+json" },
      });

      expect(joseHeader(token).cty).toBe("application/example+json");
    });

    test("CwtKit carries the caller's label", () => {
      const token = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(claims, {
        header: { cty: "application/cwt" },
      });

      expect(coseHeader(token).get(COSE_CTY)).toBe("application/cwt");
    });

    test("CwmKit carries the caller's label", () => {
      const token = new CwmKit({ kryptos: TEST_OCT_KEY_SIG, logger }).sign(claims, {
        header: { cty: "application/cwt" },
      });

      expect(coseHeader(token).get(COSE_CTY)).toBe("application/cwt");
    });
  });

  // The other half of the matrix, and the reason the claims omission is not just
  // "aegis stopped writing cty". An opaque payload could be anything, so the
  // declaration is the only thing that lets the read side hand back the type the
  // writer put in.
  describe("an OPAQUE kit declares the type it inferred", () => {
    const jws = new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const cws = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger });

    test("JwsKit: string → text/plain, Buffer → application/octet-stream", () => {
      expect(joseHeader(jws.sign(text)).cty).toBe("text/plain");
      expect(joseHeader(jws.sign(bytes)).cty).toBe("application/octet-stream");
    });

    test("CwsKit: string → text/plain, Buffer → application/octet-stream", () => {
      expect(coseHeader(cws.sign(text)).get(COSE_CTY)).toBe("text/plain");
      expect(coseHeader(cws.sign(bytes)).get(COSE_CTY)).toBe("application/octet-stream");
    });

    test("JweKit: a Dict plaintext → application/json", () => {
      const token = new JweKit({ kryptos: TEST_EC_KEY_ENC, logger }).encrypt(dict);

      expect(joseHeader(token).cty).toBe("application/json");
    });

    // The COSE encrypt twin, and it answers the SAME thing — the four opaque
    // doors are one contract, not four. `@lindorm/aes` set it: a structured
    // value is `application/json` and reconstructs as the object it came from,
    // so a Dict is a Dict in and a Dict out whichever door a caller uses.
    test("CweKit: a Dict plaintext → application/json", () => {
      const token = new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).encrypt(dict);

      expect(coseHeader(token).get(COSE_CTY)).toBe("application/json");
    });
  });

  /**
   * THE FOUR OPAQUE DOORS AGREE ON ONE ANSWER FOR ONE INPUT.
   *
   * Each row above asserts a literal, so all four could drift apart one at a
   * time and every row would still pass on its own terms. This one states the
   * property the literals are FOR: the door a caller picks decides the wire, not
   * what the payload is said to be.
   *
   * ⚠ `CweKit` was the outlier until 2026-08-14 — it alone serialised a
   * structured plaintext as CBOR and declared `application/cbor`, so a Dict
   * sealed as a COSE_Encrypt0 came back shaped by a different codec than the same
   * Dict on any other door. All four now answer `application/json`.
   */
  test("every OPAQUE door answers the same cty for the same Dict", () => {
    const jws = joseHeader(
      new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(dict),
    ).cty;
    const cws = coseHeader(
      new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(dict),
    ).get(COSE_CTY);
    const jwe = joseHeader(
      new JweKit({ kryptos: TEST_EC_KEY_ENC, logger }).encrypt(dict),
    ).cty;
    const cwe = coseHeader(
      new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).encrypt(dict),
    ).get(COSE_CTY);

    expect(new Set([jws, cws, jwe, cwe]).size).toBe(1);
    expect(jws).toBe("application/json");
  });
});
