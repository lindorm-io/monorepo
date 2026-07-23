import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_ENC,
} from "../__fixtures__/keys.js";
import { CwtError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

describe("Aegis — the two surfaces (Phase 19)", () => {
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

  const mintDefault = () =>
    aegis.mint("default", {
      expires: "1h",
      subject: "user-1",
      tokenType: "test_token",
    });

  describe("native WIRE vs DOMAIN for ONE token", () => {
    test("raw jwt.verify returns WIRE claims (sub/exp); aegis.verify returns DOMAIN claims (subject/expiresAt)", async () => {
      const { token } = await mintDefault();

      // RAW surface — native wire, JOSE-string keys, exp a NumericDate number.
      const raw = await aegis.jwt.verify(token);
      expect(raw.payload.sub).toBe("user-1");
      expect(typeof raw.payload.exp).toBe("number");
      expect(raw.payload.exp).toBe(1704099600);
      // No domain buckets on the raw surface.
      expect((raw as Record<string, unknown>).claims).toBeUndefined();

      // DOMAIN surface — domain-keyed claims, expiresAt a Date.
      const domain = await aegis.verify(token);
      expect(domain.format).toBe("jwt");
      expect(domain.claims.subject).toBe("user-1");
      expect(domain.claims.expiresAt).toEqual(new Date("2024-01-01T09:00:00.000Z"));
      // No wire `.payload` on the domain surface.
      expect((domain as Record<string, unknown>).payload).toBeUndefined();
    });

    test("wire.payload passes the untranslated wire claims through EXACTLY on the domain result", async () => {
      const { token } = await mintDefault();

      const raw = await aegis.jwt.verify(token);
      const domain = await aegis.verify(token);

      // The domain result carries the untranslated wire payload verbatim — the
      // exact dict the raw surface returns.
      expect(domain.wire?.payload).toEqual(raw.payload);
      expect(domain.wire?.payload.sub).toBe("user-1");
      expect(domain.wire?.payload.exp).toBe(1704099600);
    });
  });

  describe(".raw for the opaque JWS", () => {
    test("aegis.verify(jws) delivers the opaque payload under raw with an empty domain", async () => {
      const jws = await aegis.jws.sign("opaque-data");

      const verified = await aegis.verify(jws.token);

      expect(verified.format).toBe("jws");
      expect(verified.raw).toBe("opaque-data");
      expect(verified.claims).toEqual({});
      expect(verified.custom).toEqual({});
    });
  });

  describe("parse REFUSES an encrypted token (jwe AND cwe)", () => {
    // A JWE/CWE has no readable claims without the key — parse is keyless and
    // unverified, so it throws `parse_requires_decrypt` rather than surfacing a
    // partial result. The caller must use `aegis.decrypt`.
    test("parse throws parse_requires_decrypt on a JWE", async () => {
      amphora.add(TEST_OKP_KEY_ENC);
      const { token } = await aegis.encrypt("secret");

      expect(() => aegis.parse(token)).toThrow(
        expect.objectContaining({ code: "parse_requires_decrypt" }),
      );
    });

    test("parse throws parse_requires_decrypt on a CWE (COSE_Encrypt0)", async () => {
      amphora.add(TEST_OCT_KEY_ENC);
      const { token } = await aegis.mint(
        "id_token",
        { subject: "user-1", audience: ["client-1"] },
        { format: "cwt", encrypt: {} },
      );

      // Sanity: it is an encrypted COSE token, not a plain CWT.
      expect(Aegis.isCwe(token)).toBe(true);

      expect(() => aegis.parse(token)).toThrow(
        expect.objectContaining({ code: "parse_requires_decrypt" }),
      );
    });
  });

  describe("client_secret_jwt verify-key injection on BOTH surfaces", () => {
    // An RFC 7523 client_secret_jwt assertion is MAC'd with a client secret that
    // is NOT a vault resident — verify must accept an injected `key.kryptos`.
    const externalToken = () =>
      new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG }).sign({
        iss: "client-1",
        sub: "client-1",
        aud: [ISSUER],
        exp: 1704099600,
        jti: "assertion-1",
      });

    test("aegis.jwt.verify (raw) verifies an external-key token via key injection", async () => {
      const parsed = await aegis.jwt.verify(externalToken(), undefined, {
        key: { kryptos: TEST_OCT_KEY_SIG },
      });

      expect(parsed.payload.iss).toBe("client-1");
      expect(parsed.payload.sub).toBe("client-1");
    });

    test("aegis.verify (domain) verifies an external-key token via key injection", async () => {
      const verified = await aegis.verify(externalToken(), undefined, {
        key: { kryptos: TEST_OCT_KEY_SIG },
      });

      expect(verified.claims.issuer).toBe("client-1");
      expect(verified.claims.subject).toBe("client-1");
    });

    test("without the injected key the external-key token cannot be verified", async () => {
      // The MAC key is not in the vault and none is injected → no resolvable key.
      await expect(aegis.jwt.verify(externalToken())).rejects.toThrow();
    });
  });
});

describe("Aegis — cwm explicit format (D6)", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_SIG); // HS256 → COSE_Mac0
  });

  const mintCwm = () =>
    aegis.mint(
      "id_token",
      { subject: "user-1", audience: ["client-1"] },
      { format: "cwm" },
    );

  test("format cwm mints a verifiable COSE_Mac0 CWT", async () => {
    const { token } = await mintCwm();

    // CWT tag (61) framing, HS256 (a MAC, not a signature).
    expect(Buffer.from(token, "base64url").subarray(0, 2).toString("hex")).toBe("d83d");

    const verified = await aegis.verify("id_token", token, undefined, {
      audience: "client-1",
    });
    expect(verified.claims.subject).toBe("user-1");
  });

  test("isCwm is true for a cwm token and false for the others", async () => {
    const { token } = await mintCwm();

    expect(Aegis.isCwm(token)).toBe(true);
    // A cwm (Mac0) is NOT a cwt (Sign1) nor an opaque cws.
    expect(Aegis.isCwt(token)).toBe(false);
    expect(Aegis.isCws(token)).toBe(false);
  });

  test("read sets format 'cwm' from the COSE structure tag (Mac0)", async () => {
    const { token } = await mintCwm();

    const verified = await aegis.verify(token);
    expect(verified.format).toBe("cwm");
  });

  test("format 'cwt' with a symmetric key THROWS (the kit class gate is the backstop)", async () => {
    await expect(
      aegis.mint(
        "id_token",
        { subject: "user-1", audience: ["client-1"] },
        { format: "cwt" },
      ),
    ).rejects.toThrow(CwtError);
  });
});
