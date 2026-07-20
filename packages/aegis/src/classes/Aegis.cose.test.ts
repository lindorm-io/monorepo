import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import { AegisError } from "../errors/index.js";
import { decodeCbor } from "../internal/cose/cbor.js";
import { CwtKit } from "./CwtKit.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

describe("Aegis — COSE", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  test("mints and verifies a COSE access token (COSE_Sign1 CWT)", async () => {
    const { token } = await aegis.mint(
      "access_token",
      {
        subject: "user-1",
        audience: ["https://rs.lindorm.io/"],
        clientId: "client-1",
        scope: ["read", "write"],
      },
      { format: "cwt" },
    );

    // The token is a base64url string carrying real CBOR: the CWT tag (61 =
    // 0xd83d) wrapping a COSE_Sign1.
    const bytes = Buffer.from(token, "base64url");
    expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d");

    const verified = (await aegis.verify("access_token", token, {
      audience: "https://rs.lindorm.io/",
    })) as unknown as { claims: Record<string, unknown> };

    expect(verified.claims.subject).toBe("user-1");
    expect(verified.claims.audience).toEqual(["https://rs.lindorm.io/"]);
    expect(verified.claims.clientId).toBe("client-1");
    expect(verified.claims.scope).toEqual(["read", "write"]);
    expect(verified.claims.issuer).toBe("https://test.lindorm.io/");
    expect(verified.claims.expiresAt).toBeInstanceOf(Date);
  });

  test("mints and verifies a COSE id_token with an oct key (COSE_Mac0 CWT)", async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    const macAegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_SIG); // HS256, a confidential profile -> MAC path

    const { token } = await macAegis.mint(
      "id_token",
      { subject: "user-1", audience: ["client-1"], clientId: "client-1" },
      { format: "cwm" }, // D6: a symmetric key MACs via the explicit cwm format
    );

    const bytes = Buffer.from(token, "base64url");
    expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d"); // CWT tag
    expect(CwtKit.decode(bytes).algorithm).toBe("HS256"); // COSE_Mac0, not Sign1

    const verified = (await macAegis.verify("id_token", token, {
      audience: "client-1",
    })) as unknown as { claims: Record<string, unknown> };

    expect(verified.claims.subject).toBe("user-1");
    expect(verified.claims.issuer).toBe("https://test.lindorm.io/");
  });

  test("an oct-key access token is rejected — the COSE path shares the signing floor", async () => {
    // The access_token floor (`algClass: "asymmetric"`) is enforced on the key
    // QUERY, so it binds every encoder: COSE cannot MAC an access token with an
    // HS key any more than JOSE can sign one.
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    const macAegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_SIG);

    const error = await macAegis
      .mint(
        "access_token",
        { subject: "u", audience: ["https://rs.lindorm.io/"], clientId: "c" },
        { format: "cwt" },
      )
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(AegisError);
    expect((error as AegisError).code).toBe("sign_key_not_found");
  });

  test("an oct key MACs a profile with no algClass floor (COSE_Mac0)", async () => {
    // HS* is still a first-class COSE signer — it is the access_token PROFILE
    // that forbids it, not the COSE encoder. id_token carries no algClass.
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    const macAegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_SIG);

    const { token } = await macAegis.mint(
      "id_token",
      { subject: "u", audience: ["client-1"] },
      { format: "cwm" }, // D6: symmetric key → COSE_Mac0 via the explicit cwm format
    );

    expect(CwtKit.decode(Buffer.from(token, "base64url")).algorithm).toBe("HS256");

    const verified = (await macAegis.verify("id_token", token, {
      audience: "client-1",
    })) as unknown as { claims: Record<string, unknown> };
    expect(verified.claims.subject).toBe("u");
  });

  test("sign-then-encrypt: an id_token wrapped in COSE_Encrypt0 decrypts + verifies", async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    const encAegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // signs the inner CWT
    amphora.add(TEST_OCT_KEY_ENC); // direct (dir) recipient key for COSE_Encrypt0

    const { token } = await encAegis.mint(
      "id_token",
      { subject: "user-1", audience: ["client-1"], clientId: "client-1" },
      { format: "cwt", encrypt: {} },
    );

    // The outer COSE structure is a COSE_Encrypt0 (CBOR tag 16 = 0xd0), not a
    // bare CWT tag — the signed CWT is the encrypted plaintext.
    const bytes = Buffer.from(token, "base64url");
    expect(bytes[0]).toBe(0xd0);

    const verified = (await encAegis.verify("id_token", token, {
      audience: "client-1",
    })) as unknown as { claims: Record<string, unknown> };

    expect(verified.claims.subject).toBe("user-1");
    expect(verified.claims.issuer).toBe("https://test.lindorm.io/");
  });

  describe("sensitive claims (Phase 13 flat-wire correction, COSE)", () => {
    test("HONORS flat sensitive claims on an encrypted CWE round-trip", async () => {
      const logger = createMockLogger();
      const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
      const encAegis = new Aegis({ amphora, logger });
      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG); // signs the inner CWT
      amphora.add(TEST_OCT_KEY_ENC); // COSE_Encrypt0 recipient key

      const { token } = await encAegis.mint(
        "id_token",
        {
          subject: "user-1",
          audience: ["client-1"],
          clientId: "client-1",
          sensitive: {
            nationalIdentityNumber: "ABC-123",
            nationalIdentityNumberVerified: true,
          },
        },
        { format: "cwt", encrypt: {} },
      );

      // Encrypted outer (COSE_Encrypt0, tag 16 = 0xd0).
      expect(Buffer.from(token, "base64url")[0]).toBe(0xd0);

      const verified = (await encAegis.verify("id_token", token, {
        audience: "client-1",
      })) as unknown as { sensitive: Record<string, unknown> };

      // Sensitive claims travel FLAT on the wire but are bucketed into the domain
      // `sensitive` bag on read — surfaced here because the CWT was encrypted (CWE).
      expect(verified.sensitive.nationalIdentityNumber).toBe("ABC-123");
      expect(verified.sensitive.nationalIdentityNumberVerified).toBe(true);
    });

    test("SUPPRESSES flat sensitive claims carried by an UNENCRYPTED CWT", async () => {
      // A raw (unencrypted) CWT that carries the sensitive fields FLAT.
      const { token } = await aegis.cwt.sign({
        subject: "user-1",
        expires: "1h",
        sensitive: {
          nationalIdentityNumber: "ABC-123",
          nationalIdentityNumberVerified: true,
        },
      });

      // The DOMAIN surface suppresses sensitive claims on an unencrypted token
      // (§13.3); the raw `cwt.verify` would return them flat on the wire.
      const verified = (await aegis.verify(token)) as unknown as {
        claims: Record<string, unknown>;
        sensitive: unknown;
      };

      expect(verified.claims).not.toHaveProperty("nationalIdentityNumber");
      expect(verified.sensitive).toBeUndefined();
    });
  });

  test("explicit encryption on a non-encryptable profile is rejected", async () => {
    await expect(
      aegis.mint(
        "access_token",
        { subject: "u", audience: ["https://rs.lindorm.io/"], clientId: "c" },
        { format: "cwt", encrypt: {} },
      ),
    ).rejects.toThrow();
  });

  test("verifySmart auto-detects a COSE token (no profile, no format flag)", async () => {
    const { token } = await aegis.mint(
      "access_token",
      { subject: "user-1", audience: ["https://rs.lindorm.io/"], clientId: "client-1" },
      { format: "cwt" },
    );

    // Single-arg verify: no profile, no `format` — verifySmart sniffs the CBOR
    // COSE structure and verifies integrity (no profile floor applied).
    const verified = (await aegis.verify(token)) as unknown as {
      claims: Record<string, unknown>;
    };

    expect(verified.claims.subject).toBe("user-1");
    expect(verified.claims.issuer).toBe("https://test.lindorm.io/");
  });

  test("a wrong audience is rejected by the verify floor", async () => {
    const { token } = await aegis.mint(
      "access_token",
      { subject: "u", audience: ["https://rs.lindorm.io/"], clientId: "c" },
      { format: "cwt" },
    );

    await expect(
      aegis.verify("access_token", token, {
        audience: "https://other.lindorm.io/",
      }),
    ).rejects.toThrow();
  });

  describe("raw sign — the opaque handle (no profile)", () => {
    test("signs an arbitrary map as an OPAQUE COSE CWS, not a JOSE token", async () => {
      const { token } = await aegis.sign({
        payload: { tid: "at_abc", sec: "s3cr3t" },
        tokenType: "access_token",
        format: "cws",
      });

      // The whole point: no JOSE dot structure, so a consumer cannot split it
      // and read it as a JWT — it is base64url CBOR carrying the CWT tag (61).
      expect(token.includes(".")).toBe(false);
      const bytes = Buffer.from(token, "base64url");
      expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d");

      // The typ is `at+cws`, not `at+cwt` — the media type names it an OPAQUE CWS
      // (Phase-16 emission fix), so `isCws` recognises it and `isCwt` does not.
      expect(CwtKit.decode(bytes).typ).toBe("application/at+cws");
      expect(Aegis.isCws(token)).toBe(true);
      expect(Aegis.isCwt(token)).toBe(false);
    });

    test("round-trips the opaque raw payload through verify", async () => {
      const { token } = await aegis.sign({
        payload: { tid: "at_abc", sec: "s3cr3t" },
        tokenType: "access_token",
        format: "cws",
      });

      const verified = (await aegis.verify(token)) as unknown as {
        format: string;
        raw: Buffer;
      };

      // A CWS is OPAQUE: the payload comes back as raw CBOR bytes beside an empty
      // domain (the COSE twin of a JWS).
      expect(verified.format).toBe("cws");
      const map = decodeCbor(verified.raw, { preferMap: false }) as Record<
        string,
        unknown
      >;
      expect(map.tid).toBe("at_abc");
      expect(map.sec).toBe("s3cr3t");
    });

    test("stamps rt+cws for a refresh handle", async () => {
      const { token } = await aegis.sign({
        payload: { cid: "rtc_abc", gen: 1, sec: "s3cr3t" },
        tokenType: "refresh_token",
        format: "cws",
      });

      expect(CwtKit.decode(Buffer.from(token, "base64url")).typ).toBe(
        "application/rt+cws",
      );
    });

    test("rejects a string payload — a CWT secures a claims map", async () => {
      await expect(
        aegis.sign({ payload: "not-a-map", tokenType: "access_token", format: "cws" }),
      ).rejects.toThrow(AegisError);
    });

    test("still signs a JWS when no format is given (default unchanged)", async () => {
      const { token } = await aegis.sign({
        payload: { tid: "at_abc", sec: "s3cr3t" },
        tokenType: "access_token",
      });

      // Three base64url segments — the JOSE default is untouched.
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("the static inspectors gate JOSE vs COSE automatically", () => {
    const coseToken = async (): Promise<string> => {
      const { token } = await aegis.sign({
        payload: { tid: "at_abc", sec: "s3cr3t" },
        tokenType: "access_token",
        format: "cws",
      });
      return token;
    };

    const jwsToken = async (): Promise<string> => {
      const { token } = await aegis.sign({
        payload: { tid: "at_abc" },
        tokenType: "access_token",
      });
      return token;
    };

    test("isCose and isJose are exact counterparts across the two wire families", async () => {
      const cose = await coseToken();
      const jose = await jwsToken();

      expect(Aegis.isCose(cose)).toBe(true);
      expect(Aegis.isJose(cose)).toBe(false);

      // The dot check short-circuits a JOSE token before any CBOR work.
      expect(Aegis.isCose(jose)).toBe(false);
      expect(Aegis.isJose(jose)).toBe(true);

      // Garbage is neither.
      expect(Aegis.isCose("not a token")).toBe(false);
      expect(Aegis.isJose("not a token")).toBe(false);
    });

    // `Aegis.decode` and `Aegis.header` are DROPPED (Bit 2/8) — the COSE header
    // metadata is read via `CwtKit.decode` (raw) or off a verified token's
    // `.header`. The static-inspector coverage below stays.

    test("verify auto-detects a COSE token with no format told", async () => {
      const { token } = await aegis.mint(
        "access_token",
        { subject: "u", audience: ["https://rs.lindorm.io/"], clientId: "c" },
        { format: "cwt" },
      );

      // The whole point: the caller does NOT pass a format — verify reads it off the token.
      const verified = (await aegis.verify("access_token", token, {
        audience: "https://rs.lindorm.io/",
      })) as unknown as { claims: Record<string, unknown> };

      expect(verified.claims.subject).toBe("u");
    });
  });
});
