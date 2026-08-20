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
      const token = kit.sign({ ...jwtWire, jti: "the-jti" }, { tokenType: "at" });

      const { protectedHeader: header, payload } = JwtKit.decode(token);

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
      const token = kit.sign(cwtWire, { tokenType: "at" });

      const { protectedHeader, unprotectedHeader, payload } = CwtKit.decode(token);

      // COSE integer labels translated to their JOSE wire names + string values,
      // and the two buckets kept APART: `kid` is an advisory routing hint COSE
      // convention puts in the bucket no signature covers (RFC 9052 §3.1).
      expect(protectedHeader.alg).toBe("ES512");
      expect(protectedHeader.typ).toBe("application/at+cwt");
      expect(protectedHeader.kid).toBeUndefined();
      expect(unprotectedHeader.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(payload.iss).toBe("https://issuer.lindorm.io/");
      expect(payload.sub).toBe("user-1");
      expect(payload.cti).toBe("the-cti");
      expect(payload.scope).toEqual(["read", "write"]);
    });

    test("CwmKit.decode (COSE_Mac0) returns the unified wire header + cleartext claims", () => {
      const kit = new CwmKit({ logger, kryptos: TEST_OCT_KEY_SIG });
      const token = kit.sign(cwtWire, { tokenType: "at" });

      const { protectedHeader, unprotectedHeader, payload } = CwmKit.decode(token);

      expect(protectedHeader.alg).toBe("HS256");
      expect(protectedHeader.typ).toBe("application/at+cwt");
      expect(unprotectedHeader.kid).toBe(TEST_OCT_KEY_SIG.id);
      expect(payload.iss).toBe("https://issuer.lindorm.io/");
      expect(payload.cti).toBe("the-cti");
    });

    test("JwsKit.decode returns the unified wire header + opaque payload bytes", () => {
      const kit = new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG });
      // A Buffer stays opaque (octet cty), so decode reconstructs it as a Buffer.
      const token = kit.sign(Buffer.from("the opaque payload"));

      const { protectedHeader: header, payload } = JwsKit.decode<Buffer>(token);

      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(Buffer.isBuffer(payload)).toBe(true);
      expect(payload.toString("utf8")).toBe("the opaque payload");
    });

    test("CwsKit.decode returns the unified wire header + opaque payload bytes", () => {
      const kit = new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const bytes = Buffer.from("the opaque payload");
      const token = kit.sign(bytes, { tokenType: "at" });

      const { protectedHeader, unprotectedHeader, payload } = CwsKit.decode(token);

      expect(protectedHeader.alg).toBe("ES512");
      expect(protectedHeader.typ).toBe("application/at+cws");
      expect(unprotectedHeader.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(payload.equals(bytes)).toBe(true);
    });
  });

  describe("COSE header BUCKETS + integer-label -> wire-name translation", () => {
    test("a CWT reports protected (alg/typ) and unprotected (kid) SEPARATELY", () => {
      const kit = new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG });
      const { protectedHeader, unprotectedHeader } = CwtKit.decode(
        kit.sign(cwtWire, { tokenType: "at" }),
      );

      // alg + typ come off the PROTECTED map, kid off the UNPROTECTED one, and
      // they stay apart: merging them made a parameter no signature covers
      // indistinguishable from one it does.
      expect(protectedHeader).toMatchObject({
        alg: "ES512",
        typ: "application/at+cwt",
      });
      expect(protectedHeader.kid).toBeUndefined();
      expect(unprotectedHeader).toEqual({ kid: TEST_EC_KEY_SIG.id });
    });

    test("a parameter in BOTH maps is reported once per bucket, not resolved", () => {
      // Craft a COSE_Sign1 whose kid (label 4) sits in BOTH maps with different
      // values. There is no precedence to state any more — the buckets are
      // different statements about the token, and only one of them is signed.
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

      const { protectedHeader, unprotectedHeader } = CwsKit.decode(encodeCbor(structure));

      expect(protectedHeader.alg).toBe("ES512");
      expect(protectedHeader.kid).toBe("protected-kid");
      expect(unprotectedHeader.kid).toBe("unprotected-kid");
    });

    test("a CWE maps the COSE_Encrypt0 content-encryption label (1) to `enc`", () => {
      const kit = new CweKit({ logger, kryptos: coseEncKey });
      const token = kit.encrypt(Buffer.from("ciphertext-source"), {
        tokenType: "at",
      });

      const { protectedHeader, unprotectedHeader } = CweKit.decode(token);

      // Label 1 in Encrypt0 is the AEAD, translated to the JOSE `enc` name (not
      // a key-management `alg`); kid + iv come off the unprotected map, which is
      // where RFC 9052 §5.2 puts them.
      expect(protectedHeader.enc).toBe("A256GCM");
      expect(protectedHeader.typ).toBe("application/at+cwe");
      expect(unprotectedHeader.kid).toBe(coseEncKey.id);
      expect(typeof unprotectedHeader.iv).toBe("string");
    });
  });

  describe("uniform result shape across each format pair", () => {
    test("JWT ≡ CWT — same result keys, same shared claim keys", () => {
      const jwt = JwtKit.decode(
        new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(jwtWire, {
          tokenType: "at",
        }),
      );
      const cwt = CwtKit.decode(
        new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(cwtWire, {
          tokenType: "at",
        }),
      );

      expect(Object.keys(jwt).sort()).toEqual([
        "payload",
        "protectedHeader",
        "signature",
        "token",
        "unknown",
        "unprotectedHeader",
      ]);
      expect(Object.keys(cwt).sort()).toEqual(Object.keys(jwt).sort());

      // A compact JOSE token has ONE header and it is protected, so its
      // unprotected bucket is empty — the same result SHAPE, a true answer.
      expect(jwt.unprotectedHeader).toEqual({});

      // Shared header wire keys.
      expect(typeof jwt.protectedHeader.alg).toBe("string");
      expect(typeof cwt.protectedHeader.alg).toBe("string");
      expect(jwt.protectedHeader.kid).toBe(cwt.unprotectedHeader.kid);

      // Shared payload claim keys (jti/cti diverge by RFC and are excluded).
      const shared = ["iss", "sub", "aud", "exp", "iat", "client_id", "scope"];
      for (const key of shared) {
        expect(jwt.payload).toHaveProperty(key);
        expect(cwt.payload).toHaveProperty(key);
      }
    });

    test("JWS ≡ CWS — same result keys, both opaque Buffer payloads", () => {
      const bytes = Buffer.from("identical opaque payload");

      const jws = JwsKit.decode<Buffer>(
        new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(bytes),
      );
      const cws = CwsKit.decode(
        new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(bytes),
      );

      expect(Object.keys(jws).sort()).toEqual([
        "payload",
        "protectedHeader",
        "signature",
        "token",
        "unknown",
        "unprotectedHeader",
      ]);
      expect(Object.keys(cws).sort()).toEqual(Object.keys(jws).sort());
      expect(jws.unprotectedHeader).toEqual({});

      expect(Buffer.isBuffer(jws.payload)).toBe(true);
      expect(Buffer.isBuffer(cws.payload)).toBe(true);
      expect(jws.payload.equals(bytes)).toBe(true);
      expect(cws.payload.equals(bytes)).toBe(true);
      expect(jws.protectedHeader.alg).toBe(cws.protectedHeader.alg);
      // JOSE carries the kid protected, COSE unprotected — the ONE placement
      // divergence, now visible in the result rather than merged away.
      expect(jws.protectedHeader.kid).toBe(cws.unprotectedHeader.kid);
    });

    test("JWE ≡ CWE — header only, content NOT exposed", () => {
      const secret = "the-plaintext-secret-value";

      const jwe = JweKit.decode(
        new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC }).encrypt(secret),
      );
      const cwe = CweKit.decode(
        new CweKit({ logger, kryptos: coseEncKey }).encrypt(Buffer.from(secret)),
      );

      // Both decode to the SAME result shape: the header + the native token (the
      // content stays ciphertext — never a plaintext payload field).
      expect(Object.keys(jwe).sort()).toEqual([
        "protectedHeader",
        "token",
        "unknown",
        "unprotectedHeader",
      ]);
      expect(Object.keys(cwe).sort()).toEqual(Object.keys(jwe).sort());
      expect(jwe.unprotectedHeader).toEqual({});

      // The content is ciphertext — the plaintext must not appear anywhere.
      expect(JSON.stringify(jwe)).not.toContain(secret);
      expect(JSON.stringify(cwe)).not.toContain(secret);

      // Both expose the content-encryption under the JOSE `enc` wire name.
      expect(jwe.protectedHeader.enc).toBe("A256GCM");
      expect(cwe.protectedHeader.enc).toBe("A256GCM");
    });
  });
});
