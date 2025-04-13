import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_OKP_KEY_SIG } from "../__fixtures__/keys";
import { CwsKit } from "./CwsKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("CwsKit", () => {
  let kit: CwsKit;

  beforeEach(() => {
    kit = new CwsKit({
      logger: createMockLogger(),
      kryptos: TEST_OKP_KEY_SIG,
    });
  });

  describe("sign", () => {
    test("should sign token with plain text data", () => {
      expect(kit.sign("test data in plain text")).toEqual({
        buffer: expect.any(Buffer),
        objectId: expect.any(String),
        token: expect.any(String),
      });
    });

    test("should sign token with buffer data", () => {
      expect(kit.sign(Buffer.from("test data in buffer", "utf8"))).toEqual({
        buffer: expect.any(Buffer),
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
          protected: {
            alg: "EdDSA",
            cty: "text/plain; charset=utf-8",
            typ: "application/cose; cose-type=cose-sign",
          },
          unprotected: {
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
            oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          },
          payload: expect.any(Buffer),
          signature: expect.any(Buffer),
        },
        header: {
          algorithm: "EdDSA",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          headerType: "application/cose; cose-type=cose-sign",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "2fa52a91-7f63-5731-a55d-30d36350c642",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: "test data in plain text",
        token: expect.any(String),
      });
    });

    test("should verify token with buffer data", () => {
      const { token } = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(kit.verify(token)).toEqual({
        decoded: {
          protected: {
            alg: "EdDSA",
            cty: "application/octet-stream",
            typ: "application/cose; cose-type=cose-sign",
          },
          unprotected: {
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
            oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          },
          payload: expect.any(Buffer),
          signature: expect.any(Buffer),
        },
        header: {
          algorithm: "EdDSA",
          contentType: "application/octet-stream",
          critical: [],
          headerType: "application/cose; cose-type=cose-sign",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "2fa52a91-7f63-5731-a55d-30d36350c642",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        token: expect.any(String),
      });
    });
  });

  describe("decode", () => {
    test("should decode token with plain text data", () => {
      const { token } = kit.sign("test data in plain text", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(CwsKit.decode(token)).toEqual({
        protected: {
          alg: "EdDSA",
          cty: "text/plain; charset=utf-8",
          typ: "application/cose; cose-type=cose-sign",
        },
        unprotected: {
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: "test data in plain text",
        signature: expect.any(String),
      });
    });

    test("should decode token with buffer data", () => {
      const { token } = kit.sign(Buffer.from("test data in buffer", "utf8"), {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(CwsKit.decode(token)).toEqual({
        protected: {
          alg: "EdDSA",
          cty: "application/octet-stream",
          typ: "application/cose; cose-type=cose-sign",
        },
        unprotected: {
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
          oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        signature: expect.any(String),
      });
    });
  });

  describe("parse", () => {
    test("should parse token with plain text data", () => {
      const { token } = kit.sign("test data in plain text", {
        objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
      });

      expect(CwsKit.parse(token)).toEqual({
        decoded: {
          protected: {
            alg: "EdDSA",
            cty: "text/plain; charset=utf-8",
            typ: "application/cose; cose-type=cose-sign",
          },
          unprotected: {
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
            oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          },
          payload: "test data in plain text",
          signature: expect.any(String),
        },
        header: {
          algorithm: "EdDSA",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          headerType: "application/cose; cose-type=cose-sign",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "2fa52a91-7f63-5731-a55d-30d36350c642",
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

      expect(CwsKit.parse(token)).toEqual({
        decoded: {
          protected: {
            alg: "EdDSA",
            cty: "application/octet-stream",
            typ: "application/cose; cose-type=cose-sign",
          },
          unprotected: {
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
            oid: "ba63b8d4-500a-4646-9aac-cb45543c966d",
          },
          payload: Buffer.from("test data in buffer", "utf8"),
          signature: expect.any(String),
        },
        header: {
          algorithm: "EdDSA",
          contentType: "application/octet-stream",
          critical: [],
          headerType: "application/cose; cose-type=cose-sign",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "2fa52a91-7f63-5731-a55d-30d36350c642",
          objectId: "ba63b8d4-500a-4646-9aac-cb45543c966d",
        },
        payload: Buffer.from("test data in buffer", "utf8"),
        token,
      });
    });
  });
});
