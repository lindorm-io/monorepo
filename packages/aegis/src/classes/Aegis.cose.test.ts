import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
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

  test("the asymmetric-only policy rejects an oct key on the COSE path too", async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    const macAegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_SIG);

    // RFC 9068 §5: access tokens are asymmetric-only — HS* (COSE_Mac0) is
    // refused at the same algClass gate the JOSE path uses.
    await expect(
      macAegis.mint(
        "access_token",
        { subject: "u", audience: ["https://rs.lindorm.io/"], clientId: "c" },
        { format: "cose" },
      ),
    ).rejects.toThrow();
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
