import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
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

  describe("cws — opaque COSE_Sign1 (mirror of jws)", () => {
    test("signs an object and round-trips it faithfully through verify", async () => {
      const signed = await aegis.cws.sign(
        { tid: "at_abc", sec: "s3cr3t" },
        { tokenType: "at", header: { oid: "obj-1" } },
      );

      expect(signed.objectId).toBe("obj-1");
      // COSE, not JOSE: no dot structure, base64url CBOR carrying the CWT tag (61).
      expect(signed.token.includes(".")).toBe(false);
      const bytes = Buffer.from(signed.token, "base64url");
      expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d");

      const parsed = await aegis.cws.verify<Record<string, unknown>>(signed.token);

      // A CWS is OPAQUE — an object is negotiated via cty `application/json`, so it
      // round-trips back to the same object (no claim-label codec). It emits the
      // `+cws` media type so it is a CWS, not a CWT.
      expect(parsed.payload.tid).toBe("at_abc");
      expect(parsed.payload.sec).toBe("s3cr3t");
      expect(parsed.header.alg).toBe("ES512");
      expect(parsed.header.typ).toBe("application/at+cws");
      expect(parsed.header.cty).toBe("application/json");
      expect(parsed.header.kid).toEqual(expect.any(String));
      // The COSE verify result's `.token` is the NATIVE Buffer; the sign result's
      // `.token` is its base64url string — same bytes, compared verbatim.
      expect(parsed.token.equals(Buffer.from(signed.token, "base64url"))).toBe(true);
    });

    test("signs a string and round-trips it faithfully (text/plain)", async () => {
      const signed = await aegis.cws.sign("not-a-map", { tokenType: "access_token" });

      const parsed = await aegis.cws.verify<string>(signed.token);

      expect(parsed.payload).toBe("not-a-map");
      expect(parsed.header.cty).toBe("text/plain");
    });

    test("signs a Buffer and round-trips it faithfully (octet, cty reconstructed)", async () => {
      const signed = await aegis.cws.sign(Buffer.from("deadbeef", "hex"));

      const parsed = await aegis.cws.verify(signed.token);

      expect(Buffer.isBuffer(parsed.payload)).toBe(true);
      expect(parsed.payload.equals(Buffer.from("deadbeef", "hex"))).toBe(true);
      expect(parsed.header.cty).toBe("application/octet-stream");
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
      // `.token` is the native decrypted Buffer; `token` is its base64url string.
      expect(echoed.equals(Buffer.from(token, "base64url"))).toBe(true);
    });

    test("encrypts and decrypts raw bytes verbatim", async () => {
      const secret = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const { token } = await aegis.cwe.encrypt(secret);
      const { payload } = await aegis.cwe.decrypt(token);
      expect(payload.equals(secret)).toBe(true);
    });
  });

  describe("cwt — generic CWT with WIRE claims (mirror of jwt)", () => {
    test("signs WIRE claims verbatim and returns the native wire payload on verify", async () => {
      const signed = await aegis.cwt.sign(
        {
          iss: "https://test.lindorm.io/",
          sub: "user-1",
          aud: ["https://rs.lindorm.io/"],
          exp: 1704099600,
          scope: ["read", "write"],
          cti: "jti-1",
        },
        { tokenType: "at" },
      );

      expect(signed.tokenId).toBe("jti-1");
      expect(signed.expiresAt).toBeInstanceOf(Date);
      expect(signed.expiresOn).toBe(1704099600); // 09:00:00Z
      const bytes = Buffer.from(signed.token, "base64url");
      expect(bytes.subarray(0, 2).toString("hex")).toBe("d83d"); // CWT tag

      const parsed = await aegis.cwt.verify(signed.token);

      // The raw cwt namespace returns the NATIVE WIRE payload — COSE-name-keyed
      // (`sub`/`aud`/`cti`, temporal as Dates), NOT the domain buckets. `iss` is
      // whatever the consumer put on the wire — the raw path never defaults it.
      expect(parsed.payload.sub).toBe("user-1");
      expect(parsed.payload.iss).toBe("https://test.lindorm.io/");
      expect(parsed.payload.aud).toEqual(["https://rs.lindorm.io/"]);
      expect(parsed.payload.scope).toEqual(["read", "write"]);
      expect(parsed.payload.cti).toBe("jti-1");
      expect(parsed.payload.exp).toBeInstanceOf(Date);
      expect(parsed.header.alg).toBe("ES512");
    });

    test("a wire assert predicate rejects a non-matching claim", async () => {
      const { token } = await aegis.cwt.sign({
        iss: "https://test.lindorm.io/",
        sub: "u",
        aud: ["https://rs.lindorm.io/"],
        exp: 1704099600,
      });

      // The raw surface matches WIRE claims via the positional `assert` predicate
      // — no named domain matchers (those are the `aegis.verify` surface).
      await expect(
        aegis.cwt.verify(token, { aud: ["https://other.lindorm.io/"] }),
      ).rejects.toThrow(/Invalid token/);
    });

    test("rejects an expired CWT (exp range-checked in the kit, like jwt)", async () => {
      const { token } = await aegis.cwt.sign({
        iss: "https://test.lindorm.io/",
        sub: "u",
        aud: ["aud-1"],
        exp: 1704099600,
      });

      // Advance past the 09:00 expiry.
      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      // The exp RANGE is range-checked IN THE KIT (Phase 9 R10, exactly as
      // JwtKit does), so the expiry surfaces as the wire "Invalid token" throw.
      await expect(aegis.cwt.verify(token)).rejects.toThrow(/Invalid token/);
    });

    test("exp PRESENCE is a DOMAIN policy — the raw wire verify accepts a CWT with no exp", async () => {
      const { token } = await aegis.cwt.sign({
        iss: "https://test.lindorm.io/",
        sub: "u",
        aud: ["aud-1"],
      });

      // The raw wire `cwt.verify` range-checks a PRESENT exp only, so a CWT with
      // no exp verifies fine here.
      const parsed = await aegis.cwt.verify(token);
      expect(parsed.payload.sub).toBe("u");

      // exp presence requiredness lives on the `aegis.verify` domain surface.
      const error = await aegis
        .verify(token, { audience: "aud-1" })
        .catch((err: Error) => err);
      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("cwt_missing_claim_exp");
    });

    // Regression (bug fixed 2026-07): the RAW `aegis.cwt.verify` wrapper
    // (internal/utils/raw-verify-cwt.ts) once MANUALLY enumerated the options it
    // forwarded to `CwtKit.verify`, silently DROPPING the per-claim temporal-skip
    // flags. The fix forwards STRUCTURALLY (`const { key, ...verifyOptions }`).
    test("raw cwt.verify: expired token rejected by default, accepted with verifyExpiration:false", async () => {
      const { token } = await aegis.cwt.sign({
        iss: "https://test.lindorm.io/",
        sub: "u",
        aud: ["aud-1"],
        exp: 1704099600, // 09:00
      });

      // Advance past the 09:00 expiry.
      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      await expect(aegis.cwt.verify(token)).rejects.toThrow(/Invalid token/);

      // The regression assertion: the flag must reach the kit and drop the exp
      // RANGE bound — without the structural forward this still rejects.
      const parsed = await aegis.cwt.verify(token, undefined, {
        verifyExpiration: false,
      });
      expect(parsed.payload.sub).toBe("u");
    });
  });

  // The COSE_Mac0 (symmetric) twin of `cwt`. It needs a SYMMETRIC signing key, so
  // it runs on its own amphora (a second sig key on the shared one would make the
  // keyless cwt/cws auto-selection non-deterministic).
  describe("cwm — COSE_Mac0 with WIRE claims (symmetric twin of cwt)", () => {
    let macAmphora: IAmphora;
    let macAegis: Aegis;

    const claims = {
      iss: "https://test.lindorm.io/",
      sub: "user-1",
      aud: ["https://rs.lindorm.io/"],
      exp: 1704099600,
      cti: "jti-1",
    };

    beforeEach(async () => {
      const logger = createMockLogger();
      macAmphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
      macAegis = new Aegis({ amphora: macAmphora, logger });
      await macAmphora.setup();
      macAmphora.add(TEST_OCT_KEY_SIG); // HS* symmetric key → COSE_Mac0
    });

    test("MACs WIRE claims and round-trips them through verify (Mac0 path)", async () => {
      const signed = await macAegis.cwm.sign(claims, { tokenType: "at" });

      expect(signed.format).toBe("cwm");
      expect(signed.tokenId).toBe("jti-1");
      expect(signed.expiresOn).toBe(1704099600);

      // The integrity structure is a COSE_Mac0 (tag 17), NOT a COSE_Sign1 — so the
      // token reads as a CWM, never a CWT (the D6 structure discriminant).
      expect(Aegis.isCwm(signed.token)).toBe(true);
      expect(Aegis.isCwt(signed.token)).toBe(false);

      const parsed = await macAegis.cwm.verify(signed.token);

      // The raw cwm namespace returns the NATIVE WIRE payload (COSE-name-keyed),
      // exactly like cwt — only the integrity structure differs.
      expect(parsed.payload.sub).toBe("user-1");
      expect(parsed.payload.iss).toBe("https://test.lindorm.io/");
      expect(parsed.payload.aud).toEqual(["https://rs.lindorm.io/"]);
      expect(parsed.payload.cti).toBe("jti-1");
      expect(parsed.header.typ).toBe("application/at+cwt"); // CWM shares the CWT typ
    });

    test("a wire assert predicate rejects a non-matching claim", async () => {
      const signed = await macAegis.cwm.sign(claims);

      await expect(
        macAegis.cwm.verify(signed.token, { aud: ["https://other.lindorm.io/"] }),
      ).rejects.toThrow(/Invalid token/);
    });

    test("the symmetric gate rejects an asymmetric key (that is cwt.sign)", async () => {
      // COSE_Mac0 is a MAC — an asymmetric key cannot MAC, so the kit gate throws
      // instead of silently signing. The asymmetric twin is `aegis.cwt.sign`.
      await expect(
        macAegis.cwm.sign(claims, { key: { kryptos: TEST_EC_KEY_SIG } }),
      ).rejects.toThrow();
    });

    test("top-level verify auto-detects the CWM and returns domain claims", async () => {
      const signed = await macAegis.cwm.sign(claims);

      const parsed = (await macAegis.verify(signed.token, {
        audience: "https://rs.lindorm.io/",
      })) as unknown as { format: string; claims: Record<string, unknown> };

      expect(parsed.format).toBe("cwm");
      expect(parsed.claims.subject).toBe("user-1");
    });

    // Regression (bug fixed 2026-07): the RAW `aegis.cwm.verify` wrapper
    // (internal/utils/raw-verify-cwm.ts) once MANUALLY enumerated the options it
    // forwarded to `CwmKit.verify`, silently DROPPING the per-claim temporal-skip
    // flags. The fix forwards STRUCTURALLY (`const { key, ...verifyOptions }`).
    test("raw cwm.verify: expired token rejected by default, accepted with verifyExpiration:false", async () => {
      const signed = await macAegis.cwm.sign(claims); // exp 1704099600 (09:00)

      // Advance past the 09:00 expiry.
      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      await expect(macAegis.cwm.verify(signed.token)).rejects.toThrow(/Invalid token/);

      // The regression assertion: the flag must reach the kit and drop the exp
      // RANGE bound — without the structural forward this still rejects.
      const parsed = await macAegis.cwm.verify(signed.token, undefined, {
        verifyExpiration: false,
      });
      expect(parsed.payload.sub).toBe("user-1");
    });
  });

  describe("top-level verify auto-detects the COSE wire", () => {
    test("verify(token) reads an opaque CWS as raw bytes (empty domain)", async () => {
      const { token } = await aegis.cws.sign({ tid: "at_abc" }, { tokenType: "at" });

      const parsed = (await aegis.verify(token)) as unknown as {
        format: string;
        raw: Record<string, unknown>;
        header: { headerType?: string };
      };

      expect(parsed.format).toBe("cws");
      // An object is negotiated via cty `application/json`, so it round-trips back
      // to the same object beside an empty domain.
      expect(parsed.raw.tid).toBe("at_abc");
      expect(parsed.header.headerType).toBe("application/at+cws");
    });

    test("verify(token, options) validates a generic CWT's standard claims", async () => {
      const { token } = await aegis.cwt.sign({
        iss: "https://test.lindorm.io/",
        sub: "u",
        aud: ["aud-1"],
        exp: 1704099600,
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

  // The user's demand: a COSE verify result's header must be the SAME joined,
  // wire-named header as JOSE — not a narrow {alg,kid,typ} triple, and not the
  // domain-named header. CWT ≡ JWT at the raw verify-result level.
  describe("verify-result header parity (CWT ≡ JWT, wire-named)", () => {
    test("cwt.verify and jwt.verify return the SAME wire-named header shape", async () => {
      const cwt = await aegis.cwt.sign(
        {
          iss: "https://test.lindorm.io/",
          sub: "user-1",
          aud: ["https://rs.lindorm.io/"],
          exp: 1704099600,
        },
        { tokenType: "at" },
      );
      const jwt = await aegis.jwt.sign(
        {
          iss: "https://test.lindorm.io/",
          sub: "user-1",
          aud: ["https://rs.lindorm.io/"],
          exp: 1704099600,
        },
        { tokenType: "at" },
      );

      const cwtVerified = await aegis.cwt.verify(cwt.token);
      const jwtVerified = await aegis.jwt.verify(jwt.token);

      // Both raw verify results carry the WIRE header — the protected + unprotected
      // maps merged and translated to JOSE wire names (`alg`/`kid`/`typ`), NEVER the
      // domain-named header (`algorithm`/`keyId`/`headerType`/`baseFormat`) and never
      // the former narrow triple type. Identical shape across COSE and JOSE.
      for (const header of [cwtVerified.header, jwtVerified.header]) {
        expect(header.alg).toBe("ES512");
        expect(typeof header.kid).toBe("string");
        expect(header).not.toHaveProperty("algorithm");
        expect(header).not.toHaveProperty("keyId");
        expect(header).not.toHaveProperty("headerType");
        expect(header).not.toHaveProperty("baseFormat");
      }

      // typ is the wire media type (the merged protected-header value), read the
      // same way on both.
      expect(cwtVerified.header.typ).toBe("application/at+cwt");
      expect(jwtVerified.header.typ).toBe("application/at+jwt");
    });
  });
});
