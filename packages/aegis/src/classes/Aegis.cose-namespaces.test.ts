import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import { AegisError } from "../errors/index.js";
import { decodeCbor } from "../internal/cose/cbor.js";
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
    test("signs an opaque map and round-trips its raw bytes through verify", async () => {
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

      // A CWS is OPAQUE — the verified payload is the raw CBOR bytes, not a
      // decoded claim map. It emits the `+cws` media type so it is a CWS, not a CWT.
      const map = decodeCbor(parsed.raw, { preferMap: false }) as Record<string, unknown>;
      expect(map.tid).toBe("at_abc");
      expect(map.sec).toBe("s3cr3t");
      expect(parsed.header.alg).toBe("ES512");
      expect(parsed.header.typ).toBe("application/at+cws");
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
        { typ: "application/at+cwt" },
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
  });

  describe("top-level verify auto-detects the COSE wire", () => {
    test("verify(token) reads an opaque CWS as raw bytes (empty domain)", async () => {
      const { token } = await aegis.cws.sign(
        { tid: "at_abc" },
        { tokenType: "access_token" },
      );

      const parsed = (await aegis.verify(token)) as unknown as {
        format: string;
        raw: Buffer;
        header: { headerType?: string };
      };

      expect(parsed.format).toBe("cws");
      const map = decodeCbor(parsed.raw, { preferMap: false }) as Record<string, unknown>;
      expect(map.tid).toBe("at_abc");
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
});
