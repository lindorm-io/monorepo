import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { buildProfileClaims } from "../internal/utils/build-profile-claims.js";
import { defaultProfile } from "../internal/profiles/definitions/default.js";
import type { SignContent, SignJwtContent } from "../types/index.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";
import { beforeEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

/**
 * A logged token must be debuggable but unusable: `header.payload` survives, the signature
 * never does. These tests mint REAL tokens and assert the real signature is absent from
 * every log line and every error payload the kits produce.
 */
describe("token redaction", () => {
  let logs: Array<unknown>;
  let logger: ILogger;

  const logged = (): string => JSON.stringify(logs);

  beforeEach(() => {
    logs = [];
    logger = createMockLogger((...args: Array<unknown>) => logs.push(args));
  });

  describe("JwsKit", () => {
    let kit: JwsKit;

    beforeEach(() => {
      kit = new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG });
    });

    test("should log a signed token without its signature", () => {
      const { token } = kit.sign("data");
      const [header, payload, signature] = token.split(".");

      expect(signature).toBeTruthy();
      expect(logged()).toContain(`${header}.${payload}`);
      expect(logged()).not.toContain(signature);
    });

    test("should log a verified token without its signature", () => {
      const { token } = kit.sign("data");
      const [header, payload, signature] = token.split(".");

      logs = [];
      kit.verify(token);

      expect(logged()).toContain(`${header}.${payload}`);
      expect(logged()).not.toContain(signature);
    });

    test("should not carry the signature in the signature_invalid error payload", () => {
      const { token } = kit.sign("data");
      const [header, payload, signature] = token.split(".");

      const tampered = `${header}.${payload}.${signature.slice(0, -4)}beef`;

      try {
        kit.verify(tampered);
        throw new Error("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe("jws_signature_invalid");
        expect(err.debug.token).toBe(`${header}.${payload}`);
        expect(JSON.stringify(err.debug)).not.toContain(signature.slice(0, -4));
      }
    });
  });

  describe("JweKit", () => {
    let kit: JweKit;

    beforeEach(() => {
      kit = new JweKit({ logger, kryptos: TEST_EC_KEY_ENC });
    });

    test("should log an encrypted token as its protected header only", () => {
      const { token } = kit.encrypt("data");
      const [protectedHeader, key, iv, content, tag] = token.split(".");

      expect(logged()).toContain(protectedHeader);

      for (const part of [key, iv, content, tag]) {
        if (part) expect(logged()).not.toContain(part);
      }
    });

    test("should log a decrypted token as its protected header only", () => {
      const { token } = kit.encrypt("data");
      const [protectedHeader, , , content] = token.split(".");

      logs = [];
      kit.decrypt(token);

      expect(logged()).toContain(protectedHeader);
      expect(logged()).not.toContain(content);
    });
  });

  describe("JwtKit", () => {
    const issuer = "https://test.lindorm.io/";

    let kit: JwtKit;

    // JwtKit.sign is policy-free and injects no envelope claims; verify requires an iss.
    // Mint through the default profile, exactly as aegis.mint("default", …) does.
    const sign = (content: SignContent) => {
      const claims = buildProfileClaims(
        { algorithm: kit.algorithm, issuer },
        defaultProfile,
        content,
        {},
      );
      return kit.signClaims(claims, content as SignJwtContent, {});
    };

    beforeEach(() => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_EC_KEY_SIG });
    });

    test("should log a signed token without its signature", () => {
      const { token } = sign({ expires: "1h", subject: "subject" });
      const [header, payload, signature] = token.split(".");

      expect(signature).toBeTruthy();
      expect(logged()).toContain(`${header}.${payload}`);
      expect(logged()).not.toContain(signature);
    });

    test("should log a verified token without its signature", () => {
      const { token } = sign({ expires: "1h", subject: "subject" });
      const [header, payload, signature] = token.split(".");

      logs = [];
      kit.verify(token);

      expect(logged()).toContain(`${header}.${payload}`);
      expect(logged()).not.toContain(signature);
    });

    test("should log a dpop proof from verify options without its signature", () => {
      const { token } = sign({ expires: "1h", subject: "subject" });
      const proof = sign({ expires: "1h", subject: "proof" }).token;
      const [, , proofSignature] = proof.split(".");

      logs = [];

      // The proof is rejected (the token is not DPoP-bound), but "Verifying token" has
      // already logged the options — which is where the raw proof used to leak.
      expect(() => kit.verify(token, { dpopProof: proof })).toThrow();

      expect(logged()).not.toContain(proofSignature);
    });

    test("should not carry the signature in the signature_invalid error payload", () => {
      const { token } = sign({ expires: "1h", subject: "subject" });
      const [header, payload, signature] = token.split(".");

      const tampered = `${header}.${payload}.${signature.slice(0, -4)}beef`;

      try {
        kit.verify(tampered);
        throw new Error("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe("jwt_signature_invalid");
        expect(err.debug.token).toBe(`${header}.${payload}`);
        expect(JSON.stringify(err.debug)).not.toContain(signature.slice(0, -4));
      }
    });

    // Aegis refuses to put a government identifier on the wire in clear — it forces
    // encryption and omits the claim when no recipient key resolves. Logging the same
    // number in cleartext would walk straight around that guarantee.
    test("should never log a sensitive identity number", () => {
      const nationalIdentityNumber = "19900101-1234";

      kit.sign({
        subject: "sub-1",
        expires: "1h",
        tokenType: "id_token",
        sensitiveIdentity: {
          nationalIdentityNumber,
          nationalIdentityNumberVerified: true,
        },
      });

      expect(logged()).not.toContain(nationalIdentityNumber);
      expect(logged()).toContain("[Filtered]");
      // the assurance flag is not a secret and is what you debug against
      expect(logged()).toContain("nationalIdentityNumberVerified");
    });

    test("should never log a sensitive identity number staged as a wire claim", () => {
      const socialSecurityNumber = "078-05-1120";

      kit.signClaims(
        {
          sub: "sub-1",
          exp: 1704099600,
          sensitive_identity: { social_security_number: socialSecurityNumber },
        },
        { subject: "sub-1", expires: "1h", tokenType: "id_token" },
      );

      expect(logged()).not.toContain(socialSecurityNumber);
      expect(logged()).toContain("[Filtered]");
    });
  });
});
