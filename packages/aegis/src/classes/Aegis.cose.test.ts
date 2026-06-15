import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
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
      { format: "cose" },
    );

    // The token is a base64url string carrying real CBOR: the CWT tag (61 =
    // 0xd83d) wrapping a COSE_Sign1.
    const bytes = Buffer.from(token, "base64url");
    expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d");

    const verified = (await aegis.verify("access_token", token, {
      format: "cose",
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
      { format: "cose" },
    );

    const bytes = Buffer.from(token, "base64url");
    expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d"); // CWT tag
    expect(CwtKit.decode(bytes).algorithm).toBe("HS256"); // COSE_Mac0, not Sign1

    const verified = (await macAegis.verify("id_token", token, {
      format: "cose",
      audience: "client-1",
    })) as unknown as { claims: Record<string, unknown> };

    expect(verified.claims.subject).toBe("user-1");
    expect(verified.claims.issuer).toBe("https://test.lindorm.io/");
  });

  test("an oct-key access token is permitted with a warning, not rejected", async () => {
    // RFC 9068 §2.1 permits any signing algorithm and RECOMMENDS asymmetric, so
    // HS* (COSE_Mac0) is allowed — lindorm only warns, it does not reject.
    const logged: string[] = [];
    const logger = createMockLogger((msg: unknown) => {
      if (typeof msg === "string") logged.push(msg);
    });
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    const macAegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_SIG);

    const { token } = await macAegis.mint(
      "access_token",
      { subject: "u", audience: ["https://rs.lindorm.io/"], clientId: "c" },
      { format: "cose" },
    );

    // Minted as a COSE_Mac0 (not rejected), and the advisory was warned.
    expect(CwtKit.decode(Buffer.from(token, "base64url")).algorithm).toBe("HS256");
    expect(logged.some((m) => m.includes("RFC 9068 §2.1"))).toBe(true);

    const verified = (await macAegis.verify("access_token", token, {
      format: "cose",
      audience: "https://rs.lindorm.io/",
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
      { format: "cose", encrypt: {} },
    );

    // The outer COSE structure is a COSE_Encrypt0 (CBOR tag 16 = 0xd0), not a
    // bare CWT tag — the signed CWT is the encrypted plaintext.
    const bytes = Buffer.from(token, "base64url");
    expect(bytes[0]).toBe(0xd0);

    const verified = (await encAegis.verify("id_token", token, {
      format: "cose",
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
        { format: "cose", encrypt: {} },
      ),
    ).rejects.toThrow();
  });

  test("verifySmart auto-detects a COSE token (no profile, no format flag)", async () => {
    const { token } = await aegis.mint(
      "access_token",
      { subject: "user-1", audience: ["https://rs.lindorm.io/"], clientId: "client-1" },
      { format: "cose" },
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
      { format: "cose" },
    );

    await expect(
      aegis.verify("access_token", token, {
        format: "cose",
        audience: "https://other.lindorm.io/",
      }),
    ).rejects.toThrow();
  });
});
