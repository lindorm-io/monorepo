import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";

const MOCKED = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MOCKED);

// The COSE namespace family (cwe/cws/cwt) mirrors the JOSE namespaces
// (jwe/jws/jwt): same ergonomic surface, same key resolution, COSE wire.
describe("Aegis — COSE namespaces", () => {
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // ES512 signer
    amphora.add(TEST_OCT_KEY_ENC); // dir recipient key for COSE_Encrypt0
  });

  afterEach(() => {
    MockDate.set(MOCKED);
  });

  describe("cws — raw COSE_Sign1 (mirror of jws)", () => {
    test("signs an opaque claims map and round-trips it through verify", async () => {
      const signed = await aegis.cws.sign(
        { tid: "at_abc", sec: "s3cr3t" },
        { tokenType: "access_token", objectId: "obj-1" },
      );

      expect(signed.objectId).toBe("obj-1");
      // COSE, not JOSE: no dot structure, base64url CBOR carrying the CWT tag (61).
      expect(signed.token.includes(".")).toBe(false);
      const bytes = Buffer.from(signed.token, "base64url");
      expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d");

      const parsed = await aegis.cws.verify(signed.token);

      expect(parsed.claims.tid).toBe("at_abc");
      expect(parsed.claims.sec).toBe("s3cr3t");
      expect(parsed.header.alg).toBe("ES512");
      expect(parsed.header.typ).toBe("application/at+cwt");
      expect(parsed.header.kid).toEqual(expect.any(String));
      expect(parsed.token).toBe(signed.token);
    });

    test("rejects a string payload — a raw CWS secures a claims map", async () => {
      await expect(
        // @ts-expect-error — CwsContent is a claims object, never a string
        aegis.cws.sign("not-a-map", { tokenType: "access_token" }),
      ).rejects.toThrow(AegisError);
    });
  });

  describe("cwe — COSE_Encrypt0 (mirror of jwe)", () => {
    test("encrypts and decrypts a string payload with a symmetric enc key", async () => {
      const { token } = await aegis.cwe.encrypt("hello cose");

      // The outer COSE structure is a bare COSE_Encrypt0 (CBOR tag 16 = 0xd0).
      const bytes = Buffer.from(token, "base64url");
      expect(bytes[0]).toBe(0xd0);

      const { payload, token: echoed } = await aegis.cwe.decrypt(token);

      expect(payload.toString("utf8")).toBe("hello cose");
      expect(echoed).toBe(token);
    });

    test("encrypts and decrypts raw bytes verbatim", async () => {
      const secret = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const { token } = await aegis.cwe.encrypt(secret);
      const { payload } = await aegis.cwe.decrypt(token);
      expect(payload.equals(secret)).toBe(true);
    });
  });

  describe("cwt — generic CWT with standard claims (mirror of jwt)", () => {
    test("signs standard claims and validates them on verify", async () => {
      const signed = await aegis.cwt.sign(
        {
          subject: "user-1",
          audience: ["https://rs.lindorm.io/"],
          expires: "1h",
          scope: ["read", "write"],
          tokenType: "access_token",
        },
        { tokenId: "jti-1" },
      );

      expect(signed.tokenId).toBe("jti-1");
      expect(signed.expiresAt).toBeInstanceOf(Date);
      expect(signed.expiresOn).toBe(1704099600); // 09:00:00Z
      const bytes = Buffer.from(signed.token, "base64url");
      expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d"); // CWT tag

      const parsed = await aegis.cwt.verify(signed.token, {
        audience: "https://rs.lindorm.io/",
      });

      expect(parsed.claims.subject).toBe("user-1");
      expect(parsed.claims.issuer).toBe("https://test.lindorm.io/"); // defaulted from deployment
      expect(parsed.claims.audience).toEqual(["https://rs.lindorm.io/"]);
      expect(parsed.claims.scope).toEqual(["read", "write"]);
      expect(parsed.claims.tokenId).toBe("jti-1");
      expect(parsed.claims.expiresAt).toBeInstanceOf(Date);
      expect(parsed.header.alg).toBe("ES512");
    });

    test("rejects a wrong audience", async () => {
      const { token } = await aegis.cwt.sign({
        subject: "u",
        audience: ["https://rs.lindorm.io/"],
        expires: "1h",
      });

      await expect(
        aegis.cwt.verify(token, { audience: "https://other.lindorm.io/" }),
      ).rejects.toThrow(AegisError);
    });

    test("rejects an expired CWT (exp range-checked, like jwt)", async () => {
      const { token } = await aegis.cwt.sign({
        subject: "u",
        audience: ["aud-1"],
        expires: "1h",
      });

      // Advance past the 09:00 expiry.
      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      await expect(aegis.cwt.verify(token, { audience: "aud-1" })).rejects.toThrow(
        AegisError,
      );
    });

    test("rejects a CWT with no exp when expPresence is required (default)", async () => {
      const { token } = await aegis.cwt.sign({ subject: "u", audience: ["aud-1"] });

      const error = await aegis.cwt
        .verify(token, { audience: "aud-1" })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("cwt_missing_claim_exp");
    });

    test("accepts a CWT with no exp when expPresence is optional", async () => {
      const { token } = await aegis.cwt.sign({ subject: "u", audience: ["aud-1"] });

      const parsed = await aegis.cwt.verify(token, {
        audience: "aud-1",
        expPresence: "optional",
      });

      expect(parsed.claims.subject).toBe("u");
    });
  });

  describe("top-level verify auto-detects the COSE wire", () => {
    test("verify(token) types a raw COSE_Sign1 as a ParsedCws (no validation)", async () => {
      const { token } = await aegis.cws.sign(
        { tid: "at_abc" },
        { tokenType: "access_token" },
      );

      const parsed = (await aegis.verify(token)) as unknown as {
        claims: Record<string, unknown>;
        header: { typ?: string };
      };

      expect(parsed.claims.tid).toBe("at_abc");
      expect(parsed.header.typ).toBe("application/at+cwt");
    });

    test("verify(token, options) validates a generic CWT's standard claims", async () => {
      const { token } = await aegis.cwt.sign({
        subject: "u",
        audience: ["aud-1"],
        expires: "1h",
      });

      const parsed = (await aegis.verify(token, { audience: "aud-1" })) as unknown as {
        claims: Record<string, unknown>;
      };
      expect(parsed.claims.subject).toBe("u");

      await expect(aegis.verify(token, { audience: "other" })).rejects.toThrow(
        AegisError,
      );
    });
  });
});
