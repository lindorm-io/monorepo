import { createMockLogger } from "@lindorm/logger/mocks/jest";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys";
import { JwsKit } from "./JwsKit";

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
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        }),
      ).toEqual({
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        token: expect.any(String),
      });
    });

    test("should sign token with buffer data", () => {
      expect(
        kit.sign(Buffer.from("test data in buffer", "utf8"), {
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        }),
      ).toEqual({
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        token: expect.any(String),
      });
    });

    test("should sign token without objectId and omit oid from header", () => {
      const { token, objectId } = kit.sign("test data in plain text");

      expect(objectId).toBeUndefined();

      const { header } = JwsKit.decode(token);
      expect(header).not.toHaveProperty("oid");
    });
  });

  describe("verify", () => {
    test("should verify token with plain text data", () => {
      const { token } = kit.sign("test data in plain text", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(kit.verify(token)).toEqual({
        decoded: {
          header: {
            alg: "ES512",
            cty: "text/plain; charset=utf-8",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
            oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
            typ: "JWS",
          },
          payload: "test data in plain text",
          signature: expect.any(String),
        },
        header: {
          algorithm: "ES512",
          baseFormat: "JWS",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          headerType: "JWS",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: "test data in plain text",
        token,
      });
    });

    test("should verify token with buffer data", () => {
      const { token } = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(kit.verify(token)).toEqual({
        decoded: {
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
        },
        header: {
          algorithm: "ES512",
          baseFormat: "JWS",
          contentType: "application/octet-stream",
          critical: [],
          headerType: "JWS",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        token,
      });
    });
  });

  describe("tokenType round-trip", () => {
    test("should surface tokenType on verified header when signed with it", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        tokenType: "refresh_token",
      });

      const parsed = kit.verify(token);

      expect(parsed.header.headerType).toBe("rt+jws");
      expect(parsed.header.tokenType).toBe("refresh_token");
    });

    test("should round-trip a custom tokenType", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        tokenType: "my_custom_thing",
      });

      const parsed = kit.verify(token);

      expect(parsed.header.headerType).toBe("my_custom_thing+jws");
      expect(parsed.header.tokenType).toBe("my_custom_thing");
    });

    test("should leave tokenType undefined when not supplied on sign", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      const parsed = kit.verify(token);

      expect(parsed.header.headerType).toBe("JWS");
      expect(parsed.header.tokenType).toBeUndefined();
    });
  });

  describe("decode", () => {
    test("should decode token with plain text data", () => {
      const { token } = kit.sign("test data in plain text", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(JwsKit.decode(token)).toEqual({
        header: {
          alg: "ES512",
          cty: "text/plain; charset=utf-8",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          typ: "JWS",
        },
        payload: "test data in plain text",
        signature: expect.any(String),
      });
    });

    test("should decode token with buffer data", () => {
      const { token } = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(JwsKit.decode(token)).toEqual({
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

  describe("parse", () => {
    test("should parse token with plain text data", () => {
      const { token } = kit.sign("test data in plain text", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(JwsKit.parse(token)).toEqual({
        decoded: {
          header: {
            alg: "ES512",
            cty: "text/plain; charset=utf-8",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
            oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
            typ: "JWS",
          },
          payload: "test data in plain text",
          signature: expect.any(String),
        },
        header: {
          algorithm: "ES512",
          baseFormat: "JWS",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          headerType: "JWS",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: "test data in plain text",
        token,
      });
    });

    test("should parse token with buffer data", () => {
      const { token } = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(JwsKit.parse(token)).toEqual({
        decoded: {
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
        },
        header: {
          algorithm: "ES512",
          baseFormat: "JWS",
          contentType: "application/octet-stream",
          critical: [],
          headerType: "JWS",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        token,
      });
    });
  });

  describe("critical header parameter rejection", () => {
    test("should reject RFC-valid token with an extension critical parameter aegis does not implement", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      // Craft a malicious header with a well-formed crit: the extension
      // parameter 'lindorm_ext' is not IANA-registered and is present in
      // the header, so it passes RFC 7515 §4.1.11 well-formedness. Aegis
      // should still reject it because it does not understand the extension.
      const decoded = JwsKit.decode(token);
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
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      // crit lists 'missing_ext' but the header does not contain it — violates
      // RFC 7515 §4.1.11 well-formedness rules.
      const decoded = JwsKit.decode(token);
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
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      // crit must not contain registered params per RFC 7515 §4.1.11.
      const decoded = JwsKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: ["alg"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/IANA-registered/);
    });

    test("should reject crit that is an empty array", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      const decoded = JwsKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: [] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/empty/);
    });

    test("should accept token with empty critical array", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });
  });
});
