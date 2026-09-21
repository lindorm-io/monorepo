import { encode, Tag } from "cbor2";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC, TEST_OCT_KEY_ENC } from "./keys.js";
import {
  CBOR_TAG,
  inspectToken,
  WireInspectionError,
  type CoseInspection,
  type JoseInspection,
} from "./inspect-token.js";
import {
  createTestDeployment,
  DEFAULT_CLOCK,
  ISSUER,
  NOW,
  RESOURCE,
  type TestDeployment,
} from "./test-deployment.js";

/**
 * The inspector's own proof. A guard nothing exercises is a promise nobody has
 * read, and this one guards every raw-wire assertion the feature steps and the
 * knob probes make.
 *
 * Two halves, and both are needed:
 *
 * - a HAND-BUILT COSE structure, where the bytes are known because this file
 *   wrote them, so the inspector is checked against a ground truth that owes
 *   nothing to aegis; and
 * - REAL aegis output, so the inspector is known to read the thing it is
 *   actually pointed at.
 *
 * Every assertion is stated in the WIRE's vocabulary — integer labels and JOSE
 * names — and several assert the NEGATIVE (`has(4)` is false on the protected
 * bucket, `has("cti")` is false in a CWT payload), because an inspector that
 * merged the two COSE buckets, or reported domain names, would pass every
 * positive assertion here and fail exactly those.
 */

const KEY_ID = "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7";

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);
const textOf = (value: unknown): string =>
  Buffer.from(value as Uint8Array).toString("utf8");

/**
 * A COSE_Sign1 assembled by hand, from `cbor2` alone: `[protected, unprotected,
 * payload, signature]` (RFC 9052 §4.2), wrapped in the CWT tag 61 (RFC 8392 §9.4).
 * The signature is three arbitrary bytes — the inspector reads structure, never
 * cryptography.
 */
const handBuiltCose = ({
  protectedLabels,
  unprotectedLabels,
  payloadLabels,
}: {
  protectedLabels: ReadonlyArray<[number | string, unknown]>;
  unprotectedLabels: ReadonlyArray<[number | string, unknown]>;
  payloadLabels: ReadonlyArray<[number | string, unknown]>;
}): string =>
  Buffer.from(
    encode(
      new Tag(CBOR_TAG.cwt, [
        // The protected bucket is a BYTE STRING wrapping the encoded map.
        encode(new Map(protectedLabels)),
        new Map(unprotectedLabels),
        encode(new Map(payloadLabels)),
        new Uint8Array([1, 2, 3]),
      ]),
    ),
  ).toString("base64url");

const cose = (inspection: ReturnType<typeof inspectToken>): CoseInspection => {
  if (inspection.wire !== "cose")
    throw new Error(`expected a COSE token, read a ${inspection.wire} one`);
  return inspection;
};

const jose = (inspection: ReturnType<typeof inspectToken>): JoseInspection => {
  if (inspection.wire !== "jose")
    throw new Error(`expected a JOSE token, read a ${inspection.wire} one`);
  return inspection;
};

describe("inspectToken", () => {
  let ctx: TestDeployment;

  beforeAll(async () => {
    // The key fixtures expire in 2024; the whole package runs at a fixed clock.
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createTestDeployment();
    ctx.amphora.add(TEST_EC_KEY_ENC);
    // A COSE_Encrypt0 has a single recipient and no key management layer
    // (RFC 9052 §5.2), so the CWE half needs a `dir` key in the vault.
    ctx.amphora.add(TEST_OCT_KEY_ENC);
  });

  describe("a hand-built COSE structure", () => {
    // ⚠ NOT tagged 18 inside the CWT tag: a bare, untagged structure array is
    // legal COSE, and reporting the tag chain verbatim is what lets a caller see
    // that fact rather than have it assumed away.
    const token = handBuiltCose({
      protectedLabels: [
        [1, -36],
        [16, "application/at+cwt"],
      ],
      unprotectedLabels: [[4, utf8("key-1")]],
      payloadLabels: [
        [1, "https://issuer.example/"],
        [7, utf8("token-1")],
      ],
    });

    test("should report the CBOR tag chain outermost first", () => {
      expect(cose(inspectToken(token)).tags).toEqual([CBOR_TAG.cwt]);
    });

    test("should report the protected bucket as raw integer labels", () => {
      const { protectedHeader } = cose(inspectToken(token));

      expect(protectedHeader.get(1)).toBe(-36);
      expect(protectedHeader.get(16)).toBe("application/at+cwt");
    });

    test("should keep the two header buckets apart", () => {
      const { protectedHeader, unprotectedHeader } = cose(inspectToken(token));

      // The whole point of the split: an unprotected parameter must never be
      // readable as though a signature covered it.
      expect(protectedHeader.has(4)).toBe(false);
      expect(unprotectedHeader.has(4)).toBe(true);
      expect(unprotectedHeader.has(16)).toBe(false);
      expect(textOf(unprotectedHeader.get(4))).toBe("key-1");
    });

    test("should report the payload as raw labels with raw values", () => {
      const { payload } = cose(inspectToken(token));

      if (payload.readable === false) throw new Error(payload.reason);

      expect(payload.value.get(1)).toBe("https://issuer.example/");
      // Label 7 (`cti`) is a BYTE STRING on the wire, not the string aegis
      // reports. Reading it as bytes is the inspector doing its job.
      expect(payload.value.get(7)).toBeInstanceOf(Uint8Array);
      expect(textOf(payload.value.get(7))).toBe("token-1");
    });

    test("should distinguish an integer label from the text label that spells it", () => {
      // The int 4 and the tstr "4" are different labels (RFC 9052 §1.5), and an
      // inspector that stringified its keys would conflate them.
      const textLabelled = handBuiltCose({
        protectedLabels: [[1, -36]],
        unprotectedLabels: [["4", utf8("key-1")]],
        payloadLabels: [[1, ISSUER]],
      });

      const { unprotectedHeader } = cose(inspectToken(textLabelled));

      expect(unprotectedHeader.has("4")).toBe(true);
      expect(unprotectedHeader.has(4)).toBe(false);
    });

    test("should report a label that is absent as absent", () => {
      const noTyp = handBuiltCose({
        protectedLabels: [[1, -36]],
        unprotectedLabels: [],
        payloadLabels: [[1, ISSUER]],
      });

      const { protectedHeader } = cose(inspectToken(noTyp));

      expect(protectedHeader.has(16)).toBe(false);
      expect(protectedHeader.get(16)).toBeUndefined();
    });

    test("should report an empty protected bucket as an empty map", () => {
      // An empty protected bucket is a zero-length byte string (`h''`), NOT the
      // encoding of an empty map. RFC 9052 §3.
      const token = Buffer.from(
        encode(
          new Tag(CBOR_TAG.cwt, [
            new Uint8Array(0),
            new Map(),
            encode(new Map([[1, ISSUER]])),
            new Uint8Array([1]),
          ]),
        ),
      ).toString("base64url");

      expect(cose(inspectToken(token)).protectedHeader.size).toBe(0);
    });
  });

  describe("a real aegis JWT", () => {
    test("should report the JOSE parts, the protected header, and the payload under their wire names", async () => {
      const { token } = await ctx.aegis.jwt.sign({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: NOW + 3600,
        iat: NOW,
        jti: "token-1",
      });

      const inspection = jose(inspectToken(token));

      expect(inspection.partCount).toBe(3);
      expect(inspection.parts).toHaveLength(3);
      expect(inspection.protectedHeader).toMatchObject({
        alg: "ES512",
        kid: KEY_ID,
        typ: "JWT",
      });

      if (inspection.payload.readable === false)
        throw new Error(inspection.payload.reason);

      expect(inspection.payload.value).toMatchObject({
        iss: ISSUER,
        jti: "token-1",
        exp: NOW + 3600,
      });
      // The WIRE name, never the domain one aegis translates it to.
      expect(inspection.payload.value).not.toHaveProperty("tokenId");
    });

    test("should report no unprotected bucket at all", () => {
      // A JWS compact serialisation has no unprotected bucket (RFC 7515 §7.1).
      // `undefined`, never `{}` — an empty object is truthy and would read as a
      // bucket that exists.
      const inspection = jose(inspectToken("eyJhbGciOiJFUzUxMiJ9.e30.AAAA"));

      expect(inspection.unprotectedHeader).toBeUndefined();
    });
  });

  describe("a real aegis CWT", () => {
    test("should report the tag chain, both buckets, and the raw claim labels", async () => {
      const { token } = await ctx.aegis.cwt.sign({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: NOW + 3600,
        iat: NOW,
        cti: "token-1",
      });

      const inspection = cose(inspectToken(token));

      expect(inspection.tags).toEqual([CBOR_TAG.cwt, CBOR_TAG.sign1]);
      expect(inspection.protectedHeader.get(1)).toBe(-36);
      expect(inspection.protectedHeader.get(16)).toBe("application/cwt");

      // `kid` (label 4) rides in the UNPROTECTED bucket. RFC 9052 §3.1.
      expect(inspection.protectedHeader.has(4)).toBe(false);
      expect(textOf(inspection.unprotectedHeader.get(4))).toBe(KEY_ID);

      if (inspection.payload.readable === false)
        throw new Error(inspection.payload.reason);

      expect(inspection.payload.value.get(1)).toBe(ISSUER);
      expect(textOf(inspection.payload.value.get(7))).toBe("token-1");
      // Neither the COSE-name key nor the domain one: the wire is keyed by
      // integers, and reporting anything else would be reporting a translation.
      expect(inspection.payload.value.has("cti")).toBe(false);
      expect(inspection.payload.value.has("tokenId")).toBe(false);
    });
  });

  describe("a token whose payload cannot be read", () => {
    test("should state that a JWE carries ciphertext rather than report an empty payload", async () => {
      const { token } = await ctx.aegis.jwe.encrypt({ hello: "world" });
      const inspection = jose(inspectToken(token));

      expect(inspection.partCount).toBe(5);
      // The header IS readable — a JWE's protected header is cleartext. Which
      // key management the vault selected is not this test's business, so the
      // assertion is that the parameters are THERE and readable.
      expect(inspection.protectedHeader).toHaveProperty("alg");
      expect(inspection.protectedHeader).toHaveProperty("enc");
      expect(inspection.protectedHeader).toHaveProperty("kid");
      expect(inspection.payload).toEqual({
        readable: false,
        reason: "a 5-part JWE carries ciphertext where a JWS carries its payload",
      });
    });

    test("should state that a CWE carries ciphertext rather than report an empty payload", async () => {
      const { token } = await ctx.aegis.cwe.encrypt({ hello: "world" });
      const inspection = cose(inspectToken(token));

      expect(inspection.tags).toContain(CBOR_TAG.encrypt0);
      expect(inspection.payload).toEqual({
        readable: false,
        reason:
          "a COSE_Encrypt0 carries ciphertext where a COSE_Sign1/Mac0 carries its payload",
      });
    });

    test("should state that an opaque JWS body is not JSON", async () => {
      const { token } = await ctx.aegis.jws.sign("just some bytes");
      const inspection = jose(inspectToken(token));

      expect(inspection.partCount).toBe(3);
      if (inspection.payload.readable === true) {
        throw new Error("an opaque JWS body is not a claims payload");
      }
      expect(inspection.payload.reason).toContain("opaque JWS body");
    });

    test("should state that an opaque CWS body is not a claims map", async () => {
      const { token } = await ctx.aegis.cws.sign("just some bytes");
      const inspection = cose(inspectToken(token));

      if (inspection.payload.readable === true) {
        throw new Error("an opaque CWS body is not a claims payload");
      }
      expect(inspection.payload.reason).toContain("not a CBOR map");
    });

    test("should state that a detached payload has nothing to read", () => {
      const token = Buffer.from(
        encode(
          new Tag(CBOR_TAG.cwt, [
            encode(new Map([[1, -36]])),
            new Map(),
            null,
            new Uint8Array([1]),
          ]),
        ),
      ).toString("base64url");

      expect(cose(inspectToken(token)).payload).toEqual({
        readable: false,
        reason: "the payload is detached (nil), so there is nothing to read",
      });
    });
  });

  describe("input that is not a token", () => {
    // The inspector THROWS rather than reporting an empty result: every
    // assertion built on it is an inclusion or an exclusion, and both pass
    // vacuously over an empty container.
    test("should refuse an empty string", () => {
      expect(() => inspectToken("")).toThrow(WireInspectionError);
    });

    test("should refuse a JOSE-shaped string whose header is not JSON", () => {
      expect(() => inspectToken("aaaa.bbbb.cccc")).toThrow(
        /the first part is not a base64url JSON header/,
      );
    });

    test("should refuse bytes that are not CBOR", () => {
      expect(() =>
        inspectToken(Buffer.from("not cbor at all", "utf8").toString("base64url")),
      ).toThrow(WireInspectionError);
    });

    test("should refuse CBOR that is not a COSE structure array", () => {
      expect(() =>
        inspectToken(Buffer.from(encode({ hello: "world" })).toString("base64url")),
      ).toThrow(/not to a COSE structure array/);
    });

    test("should refuse a COSE structure array of the wrong arity", () => {
      const token = Buffer.from(
        encode(new Tag(CBOR_TAG.cwt, [new Uint8Array(0), new Map()])),
      ).toString("base64url");

      expect(() => inspectToken(token)).toThrow(/at least 3 elements, this one has 2/);
    });

    test("should refuse a structure whose protected bucket is not a byte string", () => {
      const token = Buffer.from(
        encode(
          new Tag(CBOR_TAG.cwt, [
            new Map([[1, -36]]),
            new Map(),
            encode(new Map()),
            new Uint8Array([1]),
          ]),
        ),
      ).toString("base64url");

      expect(() => inspectToken(token)).toThrow(/protected bucket is not a byte string/);
    });
  });
});
