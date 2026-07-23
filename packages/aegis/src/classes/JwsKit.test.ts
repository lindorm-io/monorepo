import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { JwsKit } from "./JwsKit.js";
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

      const { header } = JwsKit.decodeSegments(token);
      expect(header).not.toHaveProperty("oid");
    });
  });

  describe("verify", () => {
    test("should verify token with plain text data", () => {
      const token = kit.sign("test data in plain text", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      expect(kit.verify(token)).toEqual({
        header: {
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
        header: {
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

      expect(parsed.header.typ).toBe("application/rt+jws");
    });

    test("should round-trip a custom tokenType as its media-type typ", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
        tokenType: "my_custom_thing",
      });

      const parsed = kit.verify(token);

      expect(parsed.header.typ).toBe("application/my_custom_thing+jws");
    });

    test("should floor to the bare JWS typ when no tokenType is supplied on sign", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      const parsed = kit.verify(token);

      expect(parsed.header.typ).toBe("JWS");
    });
  });

  describe("decode", () => {
    test("should decode token with plain text data", () => {
      const token = kit.sign("test data in plain text", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // decodeSegments now surfaces the RAW base64url payload (reconstruction is
      // deferred to verify/decode, which read the cty).
      expect(JwsKit.decodeSegments(token)).toEqual({
        header: {
          alg: "ES512",
          cty: "text/plain",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: "dGVzdCBkYXRhIGluIHBsYWluIHRleHQ",
        signature: expect.any(String),
      });
    });

    test("should decode token with buffer data", () => {
      const token = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      expect(JwsKit.decodeSegments(token)).toEqual({
        header: {
          alg: "ES512",
          cty: "application/octet-stream",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: "dGVzdCBkYXRhIGluIGJ1ZmZlcg",
        signature: expect.any(String),
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

        expect(JwsKit.decodeSegments(token).header.alg).toBe(algorithm);

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
    test("should reject RFC-valid token with an extension critical parameter aegis does not implement", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // Craft a malicious header with a well-formed crit: the extension
      // parameter 'lindorm_ext' is not IANA-registered and is present in
      // the header, so it passes RFC 7515 §4.1.11 well-formedness. Aegis
      // should still reject it because it does not understand the extension.
      const decoded = JwsKit.decodeSegments(token);
      const headerWithCrit = {
        ...decoded.header,
        crit: ["lindorm_ext"],
        lindorm_ext: "some-value",
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(
        "Unsupported critical header parameter: lindorm_ext",
      );
    });

    test("should reject malformed crit listing a parameter not present in the header", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // crit lists 'missing_ext' but the header does not contain it — violates
      // RFC 7515 §4.1.11 well-formedness rules.
      const decoded = JwsKit.decodeSegments(token);
      const headerWithCrit = {
        ...decoded.header,
        crit: ["missing_ext"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/not present/);
    });

    test("should reject crit containing an IANA-registered parameter name", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      // crit must not contain registered params per RFC 7515 §4.1.11.
      const decoded = JwsKit.decodeSegments(token);
      const headerWithCrit = { ...decoded.header, crit: ["alg"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/IANA-registered/);
    });

    test("should reject crit that is an empty array", () => {
      const token = kit.sign("test data", {
        header: { oid: "ba63b8d4-500a-4646-9aac-cb45543c966d" },
      });

      const decoded = JwsKit.decodeSegments(token);
      const headerWithCrit = { ...decoded.header, crit: [] };

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
