import { createMockLogger } from "@lindorm/logger";
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
      expect(kit.sign("test data in plain text")).toEqual({
        objectId: expect.any(String),
        token: expect.any(String),
      });
    });

    test("should sign token with buffer data", () => {
      expect(kit.sign(Buffer.from("test data in buffer", "utf8"))).toEqual({
        objectId: expect.any(String),
        token: expect.any(String),
      });
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
    test("should reject token with unknown critical parameter", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      const decoded = JwsKit.decode(token);
      const headerWithCrit = {
        ...decoded.header,
        crit: ["unknownParam"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(
        "Unsupported critical header parameter: unknownParam",
      );
    });

    test("should reject token with multiple unknown critical parameters", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      const decoded = JwsKit.decode(token);
      const headerWithCrit = {
        ...decoded.header,
        crit: ["unknownParam1", "unknownParam2"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(
        "Unsupported critical header parameter: unknownParam1",
      );
    });

    test("should accept token with empty critical array", () => {
      const { token } = kit.sign("test data", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });
  });
});
