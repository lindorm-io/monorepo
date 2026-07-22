import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { Tag, encodeCbor } from "../internal/cose/cbor.js";
import { COSE_TAG, encodeProtectedHeader } from "../internal/cose/structures.js";
import { CweKit } from "./CweKit.js";
import { CwmKit } from "./CwmKit.js";
import { CwsKit } from "./CwsKit.js";
import { CwtKit } from "./CwtKit.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

// The mocked "now" matches the temporal fixtures; decode never checks temporal,
// but keeping it fixed makes the signed round-trips deterministic.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// Shared wire claim set. JOSE uses `jti`, COSE uses `cti` (the ONE registry
// divergence) — every other name is identical, so the uniformity assertions
// compare the shared keys.
const jwtWire = {
  iss: "https://issuer.lindorm.io/",
  sub: "user-1",
  aud: ["https://rs.lindorm.io/"],
  exp: 1704099600,
  iat: 1704092400,
  client_id: "client-1",
  scope: ["read", "write"],
};
const cwtWire = { ...jwtWire, cti: "the-cti" };

// The COSE encryption kit is direct AES-256-GCM, mirroring the oct enc key the
// JWE side uses (both `alg:"dir"`, `enc:"A256GCM"`) for the pair comparison.
const coseEncKey = KryptosKit.generate.enc.oct({
  algorithm: "dir",
  encryption: "A256GCM",
});

describe("kit decode — unified wire header + uniform per-pair result", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe("signed kits round-trip sign -> decode (no signature/MAC check)", () => {
    test("JwtKit.decode returns the unified wire header + cleartext claims", () => {
      const kit = new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const token = kit.sign({ ...jwtWire, jti: "the-jti" }, { typ: "at" });

      const { header, payload } = kit.decode(token);

      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(header.typ).toBe("application/at+jwt");
      expect(payload.iss).toBe("https://issuer.lindorm.io/");
      expect(payload.sub).toBe("user-1");
      expect(payload.jti).toBe("the-jti");
      expect(payload.scope).toEqual(["read", "write"]);
    });

    test("CwtKit.decode (COSE_Sign1) returns the unified wire header + cleartext claims", () => {
      const kit = new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const token = kit.sign(cwtWire, { typ: "application/at+cwt" });

      const { header, payload } = kit.decode(token);

      // COSE integer labels translated to their JOSE wire names + string values.
      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(header.typ).toBe("application/at+cwt");
      expect(payload.iss).toBe("https://issuer.lindorm.io/");
      expect(payload.sub).toBe("user-1");
      expect(payload.cti).toBe("the-cti");
      expect(payload.scope).toEqual(["read", "write"]);
    });

    test("CwmKit.decode (COSE_Mac0) returns the unified wire header + cleartext claims", () => {
      const kit = new CwmKit({ logger, kryptos: TEST_OCT_KEY_SIG });
      const token = kit.sign(cwtWire, { typ: "application/at+cwt" });

      const { header, payload } = kit.decode(token);

      expect(header.alg).toBe("HS256");
      expect(header.kid).toBe(TEST_OCT_KEY_SIG.id);
      expect(header.typ).toBe("application/at+cwt");
      expect(payload.iss).toBe("https://issuer.lindorm.io/");
      expect(payload.cti).toBe("the-cti");
    });

    test("JwsKit.decode returns the unified wire header + opaque payload bytes", () => {
      const kit = new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const { token } = kit.sign("the opaque payload");

      const { header, payload } = kit.decode(token);

      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(Buffer.isBuffer(payload)).toBe(true);
      expect(payload.toString("utf8")).toBe("the opaque payload");
    });

    test("CwsKit.decode returns the unified wire header + opaque payload bytes", () => {
      const kit = new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const bytes = Buffer.from("the opaque payload");
      const token = encodeCbor(kit.sign(bytes, { typ: "application/at+cws" }));

      const { header, payload } = kit.decode(token);

      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(header.typ).toBe("application/at+cws");
      expect(payload.equals(bytes)).toBe(true);
    });
  });

  describe("COSE header MERGE + integer-label -> wire-name translation", () => {
    test("a CWT merges protected (alg/typ) + unprotected (kid) into ONE wire header", () => {
      const kit = new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const { header } = kit.decode(kit.sign(cwtWire, { typ: "application/at+cwt" }));

      // alg + typ come off the PROTECTED map, kid off the UNPROTECTED map — all
      // land on one header under their JOSE wire names.
      expect(header).toMatchObject({
        alg: "ES512",
        kid: TEST_EC_KEY_SIG.id,
        typ: "application/at+cwt",
      });
    });

    test("protected wins on conflict (same label in both maps)", () => {
      // Craft a COSE_Sign1 whose kid (label 4) sits in BOTH the protected and the
      // unprotected map with different values — protected must win.
      const protectedMap = new Map<number, unknown>();
      protectedMap.set(1, algToCoseLabel("ES512")); // alg (label 1)
      protectedMap.set(4, Buffer.from("protected-kid", "utf8")); // kid (label 4)

      const unprotected = new Map<number, unknown>([
        [4, Buffer.from("unprotected-kid", "utf8")],
      ]);

      const structure = new Tag(COSE_TAG.sign1, [
        encodeProtectedHeader(protectedMap),
        unprotected,
        Buffer.from("payload"),
        Buffer.from("signature"),
      ]);

      const kit = new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const { header } = kit.decode(encodeCbor(structure));

      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe("protected-kid");
    });

    test("a CWE maps the COSE_Encrypt0 content-encryption label (1) to `enc`", () => {
      const kit = new CweKit({ logger, kryptos: coseEncKey });
      const token = encodeCbor(
        kit.encrypt(Buffer.from("ciphertext-source"), { typ: "application/at+cwe" }),
      );

      const { header } = kit.decode(token);

      // Label 1 in Encrypt0 is the AEAD, translated to the JOSE `enc` name (not
      // a key-management `alg`); kid + iv come off the unprotected map.
      expect(header.enc).toBe("A256GCM");
      expect(header.kid).toBe(coseEncKey.id);
      expect(typeof header.iv).toBe("string");
      expect(header.typ).toBe("application/at+cwe");
    });
  });

  describe("uniform result shape across each format pair", () => {
    test("JWT ≡ CWT — same result keys, same shared claim keys", () => {
      const jwt = new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).decode(
        new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(jwtWire, { typ: "at" }),
      );
      const cwt = new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).decode(
        new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(cwtWire, {
          typ: "application/at+cwt",
        }),
      );

      expect(Object.keys(jwt).sort()).toEqual(["header", "payload"]);
      expect(Object.keys(cwt).sort()).toEqual(Object.keys(jwt).sort());

      // Shared header wire keys.
      expect(typeof jwt.header.alg).toBe("string");
      expect(typeof cwt.header.alg).toBe("string");
      expect(jwt.header.kid).toBe(cwt.header.kid);

      // Shared payload claim keys (jti/cti diverge by RFC and are excluded).
      const shared = ["iss", "sub", "aud", "exp", "iat", "client_id", "scope"];
      for (const key of shared) {
        expect(jwt.payload).toHaveProperty(key);
        expect(cwt.payload).toHaveProperty(key);
      }
    });

    test("JWS ≡ CWS — same result keys, both opaque Buffer payloads", () => {
      const bytes = Buffer.from("identical opaque payload");

      const jws = new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).decode(
        new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(bytes).token,
      );
      const cws = new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).decode(
        encodeCbor(new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(bytes)),
      );

      expect(Object.keys(jws).sort()).toEqual(["header", "payload"]);
      expect(Object.keys(cws).sort()).toEqual(Object.keys(jws).sort());

      expect(Buffer.isBuffer(jws.payload)).toBe(true);
      expect(Buffer.isBuffer(cws.payload)).toBe(true);
      expect(jws.payload.equals(bytes)).toBe(true);
      expect(cws.payload.equals(bytes)).toBe(true);
      expect(jws.header.alg).toBe(cws.header.alg);
      expect(jws.header.kid).toBe(cws.header.kid);
    });

    test("JWE ≡ CWE — header only, content NOT exposed", () => {
      const secret = "the-plaintext-secret-value";

      const jwe = new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC }).decode(
        new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC }).encrypt(secret).token,
      );
      const cwe = new CweKit({ logger, kryptos: coseEncKey }).decode(
        encodeCbor(
          new CweKit({ logger, kryptos: coseEncKey }).encrypt(Buffer.from(secret)),
        ),
      );

      // Both decode to the SAME result shape: the header only.
      expect(Object.keys(jwe)).toEqual(["header"]);
      expect(Object.keys(cwe)).toEqual(["header"]);

      // The content is ciphertext — the plaintext must not appear anywhere.
      expect(JSON.stringify(jwe)).not.toContain(secret);
      expect(JSON.stringify(cwe)).not.toContain(secret);

      // Both expose the content-encryption under the JOSE `enc` wire name.
      expect(jwe.header.enc).toBe("A256GCM");
      expect(cwe.header.enc).toBe("A256GCM");
    });
  });
});
