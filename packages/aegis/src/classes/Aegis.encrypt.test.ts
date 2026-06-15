import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JweKit } from "./JweKit.js";
import { JwtKit } from "./JwtKit.js";
import { beforeEach, describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

describe("Aegis encryption (T5) and COSE seam (T6)", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("sign-then-encrypt (A5)", () => {
    const content = {
      subject: "user-1",
      audience: ["client-1"],
    };

    test("wraps an id_token in a JWE with cty application/jwt when encrypt is supplied", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content, { encrypt: {} });

      expect(JweKit.isJwe(token)).toBe(true);

      const { header } = JweKit.decode(token);
      expect(header.cty).toBe("application/jwt");
    });

    test("round-trips through decrypt-then-verify to the inner claims", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content, { encrypt: {} });

      const parsed = await aegis.verify("id_token", token, { audience: "client-1" });

      expect(parsed.decoded.payload).toMatchObject({
        iss: ISSUER,
        sub: "user-1",
        aud: ["client-1"],
      });
      // The profile floor runs on the INNER token: its typ is bare `JWT`,
      // not the outer JWE wrapper.
      expect(parsed.decoded.header.typ).toBe("JWT");
    });

    test("the inner signed token keeps the profile typ", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content, { encrypt: {} });

      const decrypted = await aegis.jwe.decrypt(token);
      const { header } = JwtKit.decode(decrypted.payload);

      expect(header.typ).toBe("JWT");
    });

    test("does not encrypt an encryptable profile when no encrypt option is given", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content);

      expect(JwtKit.isJwt(token)).toBe(true);
      expect(JweKit.isJwe(token)).toBe(false);
    });

    test("throws encryption_not_allowed when encrypt is passed for a non-encryptable profile", async () => {
      const RESOURCE = "https://rs.lindorm.io/";

      await expect(
        aegis.mint(
          "access_token",
          { subject: "user-1", audience: [RESOURCE], clientId: "client-1" },
          { encrypt: {} },
        ),
      ).rejects.toThrow(AegisError);

      await expect(
        aegis.mint(
          "access_token",
          { subject: "user-1", audience: [RESOURCE], clientId: "client-1" },
          { encrypt: {} },
        ),
      ).rejects.toMatchObject({ code: "encryption_not_allowed" });
    });

    test("propagates a missing-enc-key error when encryption is explicitly requested", async () => {
      // No enc key in the amphora — explicit encrypt must surface the failure.
      await expect(
        aegis.mint("id_token", content, { encrypt: {} }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("sensitive_identity (A5)", () => {
    const content = {
      subject: "user-1",
      audience: ["client-1"],
      sensitiveIdentity: {
        nationalIdentityNumber: "ABC-123",
        nationalIdentityNumberVerified: true,
      },
    };

    test("emits sensitive_identity inside the JWE when an enc key is resolvable", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content);

      // Encryption was forced by sensitive_identity even without an explicit
      // encrypt option.
      expect(JweKit.isJwe(token)).toBe(true);

      const decrypted = await aegis.jwe.decrypt(token);
      const { payload } = JwtKit.decode(decrypted.payload);

      expect(payload.sensitive_identity).toMatchObject({
        national_identity_number: "ABC-123",
        national_identity_number_verified: true,
      });
    });

    test("omits sensitive_identity (no encryption) when no enc key is resolvable", async () => {
      // No enc key in the amphora.
      const { token } = await aegis.mint("id_token", content);

      expect(JwtKit.isJwt(token)).toBe(true);
      expect(JweKit.isJwe(token)).toBe(false);

      const { payload } = JwtKit.decode(token);
      expect(payload.sensitive_identity).toBeUndefined();
    });
  });

  describe("COSE seam (T6)", () => {
    const RESOURCE = "https://rs.lindorm.io/";
    const content = {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    };

    // The COSE seam is now implemented (a signed CWT) — full round-trip coverage
    // lives in Aegis.cose.test.ts. Here we only assert the dispatch routes to it.
    test("mint with format cose produces a COSE token, not a JWT", async () => {
      const { token } = await aegis.mint("access_token", content, { format: "cose" });
      // CBOR (CWT tag 61 = 0xd83d), not a base64url JWT header.
      expect(Buffer.from(token, "base64url").subarray(0, 2).toString("hex")).toBe("d83d");
    });

    test("verifying a JWT as format cose is rejected (not valid CBOR)", async () => {
      const { token } = await aegis.mint("access_token", content);

      await expect(
        aegis.verify("access_token", token, { audience: RESOURCE, format: "cose" }),
      ).rejects.toMatchObject({ code: "cbor_decode_failed" });
    });

    test("format jwt (default) is unaffected on mint and verify", async () => {
      const { token } = await aegis.mint("access_token", content, { format: "jwt" });

      expect(JwtKit.isJwt(token)).toBe(true);

      const parsed = await aegis.verify("access_token", token, {
        audience: RESOURCE,
        format: "jwt",
      });

      expect(parsed.decoded.payload).toMatchObject({ sub: "user-1" });
    });
  });
});
