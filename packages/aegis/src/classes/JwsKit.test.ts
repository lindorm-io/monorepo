import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { AegisError } from "../errors/index.js";
import { JwsError } from "../errors/index.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";
import { beforeEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("JwsKit", () => {
  let kit: JwsKit;

  beforeEach(() => {
    kit = new JwsKit({
      logger: createMockLogger(),
      kryptos: TEST_EC_KEY_SIG,
    });
  });

  describe("sign", () => {
    test("should sign token with plain text data", () => {
      expect(
        kit.sign("test data in plain text", {
          header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
        }),
      ).toEqual(expect.any(String));
    });

    test("should sign token with buffer data", () => {
      expect(
        kit.sign(Buffer.from("test data in buffer", "utf8"), {
          header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
        }),
      ).toEqual(expect.any(String));
    });

    test("should sign token without objectId and omit oid from header", () => {
      const token = kit.sign("test data in plain text");

      const { protectedHeader: header } = JwsKit.decode(token);
      expect(header).not.toHaveProperty("oid");
    });
  });

  describe("verify", () => {
    test("should verify token with plain text data", () => {
      const token = kit.sign("test data in plain text", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      expect(kit.verify(token)).toEqual({
        unprotectedHeader: {},
        unknown: { protected: {}, unprotected: {} },
        protectedHeader: {
          alg: "ES512",
          cty: "text/plain",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: "test data in plain text",
        token,
      });
    });

    test("should verify token with buffer data", () => {
      const token = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      expect(kit.verify(token)).toEqual({
        unprotectedHeader: {},
        unknown: { protected: {}, unprotected: {} },
        protectedHeader: {
          alg: "ES512",
          cty: "application/octet-stream",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        token,
      });
    });
  });

  describe("typ round-trip (wire header)", () => {
    test("should surface the media-type typ on the verified WIRE header", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
        tokenType: "rt",
      });

      const parsed = kit.verify(token);

      expect(parsed.protectedHeader.typ).toBe("application/rt+jws");
    });

    test("should round-trip a custom tokenType as its media-type typ", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
        tokenType: "my_custom_thing",
      });

      const parsed = kit.verify(token);

      expect(parsed.protectedHeader.typ).toBe("application/my_custom_thing+jws");
    });

    test("should floor to the bare JWS typ when no tokenType is supplied on sign", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      const parsed = kit.verify(token);

      expect(parsed.protectedHeader.typ).toBe("JWS");
    });
  });

  describe("decode", () => {
    test("should decode token with plain text data", () => {
      const token = kit.sign("test data in plain text", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // decode reconstructs the content from the cty (string for text/plain);
      // signature is the raw b64url segment and token is the original compact.
      expect(JwsKit.decode(token)).toEqual({
        unprotectedHeader: {},
        unknown: { protected: {}, unprotected: {} },
        protectedHeader: {
          alg: "ES512",
          cty: "text/plain",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: "test data in plain text",
        signature: expect.any(String),
        token,
      });
    });

    test("should decode token with buffer data", () => {
      const token = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      expect(JwsKit.decode(token)).toEqual({
        unprotectedHeader: {},
        unknown: { protected: {}, unprotected: {} },
        protectedHeader: {
          alg: "ES512",
          cty: "application/octet-stream",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        signature: expect.any(String),
        token,
      });
    });
  });

  // The opaque/unstructured JWS twin of the JwtKit ML-DSA coverage: RFC 9964
  // registers ML-DSA for JOSE, so an AKP kryptos produces a conformant compact
  // JWS with the exact "ML-DSA-44"/"ML-DSA-65"/"ML-DSA-87" alg string, and the
  // opaque payload round-trips through sign -> verify.
  describe("ML-DSA (RFC 9964) opaque JWS", () => {
    const cases = [["ML-DSA-44"], ["ML-DSA-65"], ["ML-DSA-87"]] as const;

    test.each(cases)(
      "%s signs with the exact alg header and round-trips",
      (algorithm) => {
        const akpKit = new JwsKit({
          logger: createMockLogger(),
          kryptos: KryptosKit.generate.sig.akp({ algorithm }),
        });

        const token = akpKit.sign("post-quantum payload");

        expect(JwsKit.decode(token).protectedHeader.alg).toBe(algorithm);

        expect(akpKit.verify(token).payload).toBe("post-quantum payload");
      },
    );

    test("rejects a tampered ML-DSA signature", () => {
      const akpKit = new JwsKit({
        logger: createMockLogger(),
        kryptos: KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" }),
      });

      const token = akpKit.sign("authentic payload");
      const [header, payload, signature] = token.split(".");

      // Flip the first signature byte; the mutated compact token must not verify.
      const raw = Buffer.from(signature, "base64url");
      raw[0] ^= 0xff;
      const tampered = [header, payload, raw.toString("base64url")].join(".");

      expect(() => akpKit.verify(tampered)).toThrow();
    });
  });

  describe("critical header parameter rejection", () => {
    test("should reject a token whose crit names a specification-defined parameter", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // Craft a malicious header with a well-formed crit naming a
      // SPECIFICATION-DEFINED parameter the header already carries (`typ`). RFC 7515 §4.1.11
      // forbids the producer that shape and lets a recipient treat the token as
      // invalid for it, which aegis does. An UNREGISTERED member would reach a
      // DIFFERENT refusal — the unclaimed one — or be accepted once the caller
      // declares it (`internal/utils/reject-unknown-critical.ts`), so it cannot
      // serve as the MALFORMED probe this row needs.
      const decoded = JwsKit.decode(token);
      const headerWithCrit = {
        ...decoded.protectedHeader,
        crit: ["typ"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(
        /crit must not contain the specification-defined header parameter "typ"/,
      );
    });

    test("should reject malformed crit listing a parameter not present in the header", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // crit lists 'missing_ext' but the header does not contain it — violates
      // RFC 7515 §4.1.11 well-formedness rules.
      const decoded = JwsKit.decode(token);
      const headerWithCrit = {
        ...decoded.protectedHeader,
        crit: ["missing_ext"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/not present/);
    });

    test("should reject crit containing a specification-defined parameter name", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // crit must not contain registered params per RFC 7515 §4.1.11.
      const decoded = JwsKit.decode(token);
      const headerWithCrit = { ...decoded.protectedHeader, crit: ["alg"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/specification-defined/);
    });

    test("should reject crit that is an empty array", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      const decoded = JwsKit.decode(token);
      const headerWithCrit = { ...decoded.protectedHeader, crit: [] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/empty/);
    });

    test("should accept token with empty critical array", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      expect(() => kit.verify(token)).not.toThrow();
    });
  });
});

/**
 * The two verify gates whose CALL SITE nothing else drives.
 *
 * `assert-wire-typ.test.ts` and `assert-algorithm-match.test.ts` pin the shared
 * PREDICATES against configs they declare themselves, so both stay green over a
 * kit that stopped calling them: delete either call from `JwsKit.verify` and the
 * whole suite was still green. These drive the real kit, so the WIRING is what
 * is under test — the codes and titles below are this kit's own namespace, which
 * is the one thing a shared predicate cannot supply.
 */
describe("JwsKit — the verify gates answer under the jws tag", () => {
  test("refuses a JWT presented as a JWS, on its typ alone", () => {
    // A real JWT, signed by the SAME key, so nothing but the typ distinguishes
    // it: RFC 7515 §4.1.9 makes `typ` the declaration of what the whole object
    // is, and a claims JWT is not a thing this kit reads.
    const jwt = new JwtKit({
      logger: createMockLogger(),
      kryptos: TEST_EC_KEY_SIG,
    }).sign({ iss: "https://test.lindorm.io/", sub: "user-1" });

    const kit = new JwsKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

    let thrown: AegisError | undefined;

    try {
      kit.verify(jwt);
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(JwsError);
    expect(thrown?.code).toBe("jws_invalid_typ");
    expect(thrown?.title).toBe("JWS Invalid Typ");
    expect(thrown?.data).toEqual({ typ: "JWT" });
  });

  test("refuses a token whose header alg is not the configured key's", () => {
    // The gate runs BEFORE the signature cycle, so two unrelated keys suffice —
    // what is asserted is the reported algorithm, not a forged signature.
    const signer = new JwsKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES256" }),
    });
    const verifier = new JwsKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES512" }),
    });

    let thrown: AegisError | undefined;

    try {
      verifier.verify(signer.sign("the signed bytes"));
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(JwsError);
    expect(thrown?.code).toBe("jws_algorithm_mismatch");
    expect(thrown?.title).toBe("JWS Algorithm Mismatch");
    expect(thrown?.data).toEqual({ algorithm: "ES256" });
  });
});
