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
      { format: "cwt" },
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
      { format: "cwt" },
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
    test("signs an arbitrary map as a COSE CWT, not a JOSE token", async () => {
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

      // The typ is `at+cwt`, not `at+jws` — the media type names it a CWT.
      expect(CwtKit.decode(bytes).typ).toBe("application/at+cwt");
    });

    test("round-trips the raw payload through verify", async () => {
      const { token } = await aegis.sign({
        payload: { tid: "at_abc", sec: "s3cr3t" },
        tokenType: "access_token",
        format: "cws",
      });

      const verified = (await aegis.verify(token)) as unknown as {
        claims: Record<string, unknown>;
      };

      // The lookup coordinates come back verbatim — nothing but what we signed.
      expect(verified.claims.tid).toBe("at_abc");
      expect(verified.claims.sec).toBe("s3cr3t");
    });

    test("stamps rt+cwt for a refresh handle", async () => {
      const { token } = await aegis.sign({
        payload: { cid: "rtc_abc", gen: 1, sec: "s3cr3t" },
        tokenType: "refresh_token",
        format: "cws",
      });

      expect(CwtKit.decode(Buffer.from(token, "base64url")).typ).toBe(
        "application/rt+cwt",
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

    test("decode digs the header metadata out of a COSE token", async () => {
      const decoded = Aegis.decode(await coseToken()) as {
        typ?: string;
        kid?: string;
        algorithm?: string;
      };

      // No "Invalid token type" throw — decode routes COSE to the CWT decoder and
      // returns the header (typ / kid / alg), the pre-verify metadata.
      expect(decoded.typ).toBe("application/at+cwt");
      expect(decoded.kid).toEqual(expect.any(String));
      expect(decoded.algorithm).toBe("ES512");
    });

    test("header returns the same shape for a COSE token as for a JOSE one", async () => {
      const header = Aegis.header(await coseToken());

      expect(header.typ).toBe("application/at+cwt");
      expect(header.alg).toBe("ES512");
      expect(header.kid).toEqual(expect.any(String));
    });

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
