import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { AegisSensitive } from "../types/index.js";
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

      expect(parsed.wire?.payload).toMatchObject({
        iss: ISSUER,
        sub: "user-1",
        aud: ["client-1"],
      });
      // The outer wire is a JWE; the signed inner is a JWT.
      expect(parsed.format).toBe("jwe");
      expect(parsed.inner).toBe("jwt");
      // The profile floor runs on the INNER token: its typ is bare `JWT`,
      // not the outer JWE wrapper.
      expect(parsed.header.headerType).toBe("JWT");
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

    test("threads ECDH-ES party info from the encrypt wrapper onto the outer JWE", async () => {
      amphora.add(TEST_EC_KEY_ENC); // ECDH-ES recipient key

      const partyProducer = B64.encode(Buffer.from("producer"), "b64u");
      const partyRecipient = B64.encode(Buffer.from("recipient"), "b64u");

      const { token } = await aegis.mint("id_token", content, {
        encrypt: { partyProducer, partyRecipient },
      });

      // The outer JWE carries apu/apv, proving mint's sign-then-encrypt step
      // forwarded the wrapper's party info to JweKit.encrypt.
      const { header } = JweKit.decode(token);
      expect(header.apu).toBe(partyProducer);
      expect(header.apv).toBe(partyRecipient);

      // The token still decrypt-then-verifies to the inner claims (the KDF
      // re-derives from the on-wire apu/apv on the read side).
      const parsed = await aegis.verify("id_token", token, { audience: "client-1" });
      expect(parsed.wire?.payload).toMatchObject({ iss: ISSUER, sub: "user-1" });
    });
  });

  describe("sensitive (A5 / Phase 13 flat-wire correction)", () => {
    // The mint content input is `sensitive`, typed AegisSensitive (was the
    // nested `sensitiveIdentity`).
    const sensitive: AegisSensitive = {
      nationalIdentityNumber: "ABC-123",
      nationalIdentityNumberVerified: true,
    };
    const content = {
      subject: "user-1",
      audience: ["client-1"],
      sensitive,
    };

    test("emits sensitive claims FLAT (individual wire keys, no wrapper) inside the JWE", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content);

      // Encryption was forced by the sensitive fields even without an explicit
      // encrypt option.
      expect(JweKit.isJwe(token)).toBe(true);

      const decrypted = await aegis.jwe.decrypt(token);
      const { payload } = JwtKit.decode(decrypted.payload);

      // FLAT individual claims — NOT a nested `sensitive_identity` wrapper.
      expect(payload.national_identity_number).toBe("ABC-123");
      expect(payload.national_identity_number_verified).toBe(true);
      expect(payload.sensitive_identity).toBeUndefined();
    });

    test("omits the sensitive claims (no encryption) when no enc key is resolvable", async () => {
      // No enc key in the amphora.
      const { token } = await aegis.mint("id_token", content);

      expect(JwtKit.isJwt(token)).toBe(true);
      expect(JweKit.isJwe(token)).toBe(false);

      const { payload } = JwtKit.decode(token);
      expect(payload.national_identity_number).toBeUndefined();
      expect(payload.sensitive_identity).toBeUndefined();
    });

    test("HONORS sensitive claims into the sensitive bucket on an encrypted round-trip", async () => {
      amphora.add(TEST_EC_KEY_ENC);

      const { token } = await aegis.mint("id_token", content);
      const parsed = await aegis.verify("id_token", token, { audience: "client-1" });

      expect(parsed.sensitive).toMatchObject({
        nationalIdentityNumber: "ABC-123",
        nationalIdentityNumberVerified: true,
      });
    });

    test("SUPPRESSES flat sensitive claims carried by an UNENCRYPTED token", async () => {
      // A raw JWT that carries the sensitive fields FLAT in cleartext — the DOMAIN
      // read side must refuse to surface them (OIDC Core §13.3).
      const { token } = await aegis.jwt.sign({
        iss: ISSUER,
        sub: "user-1",
        exp: 1704099600,
        // The raw wire surface carries the sensitive fields FLAT under their
        // individual wire claim names (no domain translation, no wrapper).
        national_identity_number: "ABC-123",
        national_identity_number_verified: true,
      });

      expect(JwtKit.isJwt(token)).toBe(true);

      const parsed = await aegis.verify(token);

      // Not in the sensitive bucket, and not leaked into any claim bucket.
      expect(parsed.sensitive).toBeUndefined();
      expect(parsed.claims).not.toHaveProperty("nationalIdentityNumber");
      expect(parsed.custom).not.toHaveProperty("nationalIdentityNumber");
    });

    test("parse (unverified) also suppresses flat sensitive claims", async () => {
      const { token } = await aegis.jwt.sign({
        iss: ISSUER,
        sub: "user-1",
        exp: 1704099600,
        // The raw wire surface carries the sensitive fields FLAT under their
        // individual wire claim names (no domain translation, no wrapper).
        national_identity_number: "ABC-123",
        national_identity_number_verified: true,
      });

      const parsed = Aegis.parse(token);

      expect(parsed.sensitive).toBeUndefined();
      expect(parsed.claims).not.toHaveProperty("nationalIdentityNumber");
      expect(parsed.custom).not.toHaveProperty("nationalIdentityNumber");
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
      const { token } = await aegis.mint("access_token", content, { format: "cwt" });
      // CBOR (CWT tag 61 = 0xd83d), not a base64url JWT header.
      expect(Buffer.from(token, "base64url").subarray(0, 2).toString("hex")).toBe("d83d");
    });

    test("a JWT is auto-detected as JOSE, never misread as COSE", async () => {
      const { token } = await aegis.mint("access_token", content);

      // verify is not told a format — it detects one. A JWT is not COSE, so it routes
      // to the JOSE path and verifies normally (the old "force cose on a JWT" is gone).
      expect(Aegis.isCose(token)).toBe(false);
      await expect(
        aegis.verify("access_token", token, { audience: RESOURCE }),
      ).resolves.toBeDefined();
    });

    test("format jwt (default) is unaffected on mint and verify", async () => {
      const { token } = await aegis.mint("access_token", content, { format: "jwt" });

      expect(JwtKit.isJwt(token)).toBe(true);

      const parsed = await aegis.verify("access_token", token, {
        audience: RESOURCE,
      });

      expect(parsed.wire?.payload).toMatchObject({ sub: "user-1" });
    });
  });
});
