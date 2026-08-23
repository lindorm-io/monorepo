import { AesError } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError, CweError } from "../errors/index.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { coseByJose } from "../internal/header/header-registry.js";
import {
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { TEST_OCT_KEY_ENC, TEST_OCT_KEY_ENC_CBC } from "../__fixtures__/keys.js";
import { foreignEncrypt0 } from "../__fixtures__/foreign-encrypt0.js";
import { spliceCoseSlot } from "../__fixtures__/splice-cose-slot.js";
import { splitEncrypt0 } from "../internal/cose/split-encrypt0.js";
import { CweKit } from "./CweKit.js";

describe("CweKit (COSE_Encrypt0)", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through encrypt -> CBOR -> decrypt", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const token = kit.encrypt(payload, { tokenType: "at" });
    const { payload: out, protectedHeader: header, token: echoed } = kit.decrypt(token);

    expect(out.equals(payload)).toBe(true);
    expect(header.enc).toBe("A256GCM"); // A256GCM wire enc name
    // The result ECHOES the artifact it read. A caller that has to re-emit,
    // forward or cache the token holds the parsed result and nothing else, so an
    // echo that returned a different value — or none — would send it on with an
    // artifact that is not the one it verified.
    expect(echoed.equals(token)).toBe(true);
  });

  // ⚠ The CLASS and the CODE, not merely "it throws": this row is what the
  // structural describe below points at for the AEAD verdict, and a bare
  // `toThrow()` would pin nothing about which error a failed authentication
  // answers.
  test("rejects tampered ciphertext", () => {
    const encrypt0 = decodeCbor<Tag>(kit.encrypt(Buffer.from("secret payload")));
    const arr = encrypt0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    let thrown: unknown;

    try {
      kit.decrypt(encodeCbor(encrypt0));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AesError);
    expect((thrown as AesError).code).toBe("decryption_failed");
  });

  // ⛔ THE READ SIDE MUST MEAN WHAT THE WRITE SIDE MEANT. The label off the
  // protected header names what the SENDER used; it is not authority for what
  // this recipient agreed to accept. Both fixtures below carry the SAME 32 secret
  // bytes and differ only in the content encryption they declare, which is what
  // makes the confusion reachable at all: one `dir` secret satisfies the CEK
  // length of an AES-256-GCM key AND of an `A128CBC-HS256` (HMAC key ‖ AES-128
  // key) pair, so a peer holding it can produce a token this key decrypts under a
  // cipher, a tag length and a key split the deployment never configured.
  describe("the content-encryption label against the configured encryption", () => {
    const logger = createMockLogger();
    const payload = Buffer.from("the cwt claims bytes");

    test("carries one secret under two declared encryptions, which is what makes the pair reachable", () => {
      expect(TEST_OCT_KEY_ENC.export("b64").privateKey).toBe(
        TEST_OCT_KEY_ENC_CBC.export("b64").privateKey,
      );
      expect(TEST_OCT_KEY_ENC.encryption).toBeNull();
      expect(TEST_OCT_KEY_ENC_CBC.encryption).toBe("A128CBC-HS256");
    });

    test("refuses a token whose label names an encryption this kit is not configured to accept", () => {
      const cbcToken = new CweKit({ kryptos: TEST_OCT_KEY_ENC_CBC, logger }).encrypt(
        payload,
        { tokenType: "at", proprietary: true },
      );

      let thrown: unknown;

      try {
        new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).decrypt(cbcToken);
      } catch (error) {
        thrown = error;
      }

      // ⚠ THE WORDS, not just the code — the same reason the typ row below states
      // them: `details` is a per-call-site literal a consumer reads, and nothing
      // else in the package holds it.
      expect(thrown).toBeInstanceOf(CweError);
      expect({
        code: (thrown as CweError).code,
        title: (thrown as CweError).title,
        details: (thrown as CweError).details,
        debug: (thrown as CweError).debug,
      }).toEqual({
        code: "cwe_encryption_mismatch",
        title: "CWE Encryption Mismatch",
        details:
          "The protected header's content-encryption label does not match the content-encryption algorithm this kit is configured to accept.",
        debug: { actual: "A128CBC-HS256", encryption: "A256GCM" },
      });
    });

    // The CONTRAST: the same kit reading its OWN output is unaffected, so the
    // refusal above is attributable to the disagreement and not to the gate
    // refusing everything.
    test("accepts a token whose label names the encryption this kit is configured to accept", () => {
      const kit = new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger });

      expect(kit.decrypt(kit.encrypt(payload, { tokenType: "at" })).payload).toEqual(
        payload,
      );
    });

    // ⚠⚠ THE DEPLOYMENT FALLBACK IS PART OF THE COMPARISON. A key declaring no
    // `encryption` takes the deployment's `defaultEncryption`, so a read door that
    // did not receive the same one resolves a different floor from the door that
    // wrote the token and refuses aegis's own output. Both `internal/utils/
    // raw-decrypt-cwe.ts` and `internal/cose/cose-encryption.ts#decryptCose` pass
    // it for that reason; at the A256GCM default this test passes either way.
    test("round-trips a token minted under a deployment defaultEncryption", () => {
      const settings = {
        kryptos: TEST_OCT_KEY_ENC,
        logger,
        defaultEncryption: "A128CBC-HS256" as const,
      };
      const token = new CweKit(settings).encrypt(payload, { proprietary: true });

      expect(new CweKit(settings).decrypt(token).payload).toEqual(payload);
      expect(() =>
        new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).decrypt(token),
      ).toThrow(expect.objectContaining({ code: "cwe_encryption_mismatch" }));
    });

    // The ORDER both gates share with every other wire: a token tripping `crit`
    // and the encryption gate answers the crit refusal, because a critical
    // extension this reader does not implement makes every other verdict rest on
    // a reading the producer already called insufficient.
    test("answers the crit refusal for a token failing crit and the encryption gate together", () => {
      const cbcToken = new CweKit({ kryptos: TEST_OCT_KEY_ENC_CBC, logger }).encrypt(
        payload,
        { tokenType: "at", proprietary: true, header: { crit: ["oid"], oid: "1.2.3" } },
      );

      expect(() =>
        new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).decrypt(cbcToken),
      ).toThrow(expect.objectContaining({ code: "cwe_unsupported_crit_param" }));
    });
  });

  // A producer may omit the typ and this door accepts one that does. What it
  // refuses is a PRESENT string typ from another family. RFC 9596 §2, RFC 9596 §3.
  describe("the protected typ", () => {
    const kit = new CweKit({ kryptos, logger: createMockLogger() });
    const payload = Buffer.from("the cwt claims bytes");

    /**
     * The protected map of a genuine aegis COSE_Encrypt0, for a foreign producer
     * to re-seal with one cell changed. ⚠ Re-sealing rather than splicing is what
     * makes the ACCEPTING rows sayable at all — slot 0 is the AEAD's own AAD.
     */
    const foreignProtected = (typ: unknown): Map<number | string, unknown> => {
      const map = decodeProtectedHeader(
        splitEncrypt0(kit.encrypt(payload, { tokenType: "at" })).protectedBstr,
      );

      if (typ === undefined) map.delete(coseByJose("typ"));
      else map.set(coseByJose("typ"), typ);

      return map;
    };

    test("accepts a COSE_Encrypt0 that declares no typ at all", () => {
      const token = foreignEncrypt0(kryptos, foreignProtected(undefined), payload);

      expect(kit.decrypt(token).payload).toEqual(payload);
      expect(kit.decrypt(token).protectedHeader.typ).toBeUndefined();
    });

    // ⚠ A `uint` typ carries no media-type spelling to compare against a family, so
    // it reaches the gate as absent — the same answer `decodeCwt` gives the CWT
    // door for the identical value, which is what keeps the two COSE doors
    // agreeing on what a typ IS. RFC 9596 §2.
    test("accepts a COSE_Encrypt0 whose typ is a CoAP Content-Format uint", () => {
      const token = foreignEncrypt0(kryptos, foreignProtected(61), payload);

      // The typ is asserted as the UINT it is, not merely absent: without it the
      // row would still pass if the passthrough arm ever stopped delivering the
      // raw value, and it would then be pinning the wrong reason.
      expect(kit.decrypt(token).protectedHeader.typ).toBe(61);
      expect(kit.decrypt(token).payload).toEqual(payload);
    });

    // ⚠ THE WORDS, not just the code. `internal/utils/assert-wire-typ.test.ts`
    // enumerates this configuration, but its constants are COPIES that never read
    // production — so only driving the real door catches an edit to what THIS call
    // site passes, which is what a consumer reads.
    test("refuses a COSE_Encrypt0 typed as another media family", () => {
      const token = foreignEncrypt0(
        kryptos,
        foreignProtected("application/at+cwt"),
        payload,
      );

      let thrown: { code?: string; title?: string; details?: string; data?: unknown } =
        {};

      try {
        kit.decrypt(token);
      } catch (error) {
        thrown = error as typeof thrown;
      }

      expect(thrown).toBeInstanceOf(CweError);
      expect({
        code: thrown.code,
        title: thrown.title,
        details: thrown.details,
        data: thrown.data,
      }).toEqual({
        code: "cwe_invalid_typ",
        title: "CWE Invalid Typ",
        details:
          "Header typ must be application/cwe or a <type>+cwe media type to decrypt as a COSE_Encrypt0.",
        data: { typ: "application/at+cwt" },
      });
    });

    // The two spellings the mint itself writes, both accepted — so the gate cannot
    // refuse aegis's own output. `buildMediaType` produces exactly these.
    test("accepts both spellings the mint writes", () => {
      expect(kit.decrypt(kit.encrypt(payload, { tokenType: "at" })).payload).toEqual(
        payload,
      );
      expect(kit.decrypt(kit.encrypt(payload, {})).payload).toEqual(payload);
    });

    // The ORDER, and it is the SAME on every door that has both gates: typ answers
    // before crit (`JweKit`/`JwsKit`/`JwtKit`, and the CWT wire in
    // `internal/wire/cose-token-wire.ts`).
    test("answers the typ refusal for a token failing typ and crit together", () => {
      const map = foreignProtected("application/at+cwt");
      map.set(coseByJose("crit"), ["oid"]);
      map.set("oid", "1.2.3");

      expect(() => kit.decrypt(foreignEncrypt0(kryptos, map, payload))).toThrow(
        expect.objectContaining({ code: "cwe_invalid_typ" }),
      );
    });
  });
});

describe("CweKit — caller-controlled protected / unprotected header bags", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });
  const x5u = "https://certs.lindorm.io/leaf.pem";

  const codeOf = (fn: () => unknown): string | number | null | undefined => {
    try {
      fn();
    } catch (err) {
      return (err as AegisError).code;
    }
    return undefined;
  };

  test("places caller params protected and the kit's derived params unprotected", () => {
    const token = kit.encrypt(Buffer.from("secret"), {
      header: { cty: "application/example", x5u },
    });

    // The two BUCKETS, kept apart: what the AEAD covers, and what it does not.
    const { protectedHeader, unprotectedHeader } = kit.decrypt(token);
    expect(protectedHeader.cty).toBe("application/example");
    expect(protectedHeader.x5u).toBe(x5u);
    expect(protectedHeader.enc).toBe("A256GCM"); // enc (label 1, kit-computed)
    expect(unprotectedHeader.x5u).toBeUndefined();
    expect(unprotectedHeader.kid).toBe(kryptos.id);
    expect(unprotectedHeader.iv).toEqual(expect.any(String));

    const [protectedBstr, unprotected] = decodeCbor<Tag>(token).contents as [
      Buffer,
      Map<number, unknown>,
    ];
    const protectedMap = decodeProtectedHeader(protectedBstr);
    expect(protectedMap.has(coseByJose("cty"))).toBe(true);
    expect(protectedMap.has(coseByJose("x5u"))).toBe(true);
    expect(protectedMap.has(coseByJose("alg"))).toBe(true); // enc sits on label 1
    expect(unprotected.has(coseByJose("iv"))).toBe(true);
    expect(unprotected.has(coseByJose("kid"))).toBe(true);
  });

  // The caller states the parameter, never its bucket: `header` is the one bag a
  // REGISTERED parameter may be written into, and it travels protected. Written
  // into a custom bag, `x5u` is refused as the misplaced registered parameter it
  // is rather than accepted into the unauthenticated bucket.
  test("throws when a protected-only param is written into a custom bag", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), { custom: { unprotected: { x5u } } }),
      ),
    ).toBe("header_registered_in_custom");
  });

  test("throws when the computed iv is smuggled into a custom bag", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), {
          custom: { unprotected: { iv: Buffer.from("nope") } },
        }),
      ),
    ).toBe("header_kit_owned_in_custom");
  });

  test("throws when a crit-listed custom param is placed unprotected", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), {
          header: { crit: ["x-hint"] },
          custom: { protected: { "x-hint": "a" }, unprotected: { "x-hint": "b" } },
        }),
      ),
    ).toBe("cose_crit_param_unprotected");
  });

  test("throws when the same custom param is set in both bags", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), {
          custom: { protected: { "x-hint": "a" }, unprotected: { "x-hint": "b" } },
        }),
      ),
    ).toBe("cose_duplicate_header");
  });
});

describe("CweKit (COSE_Encrypt0) — AES-CCM", () => {
  // All eight COSE AES-CCM variants: both key sizes (128/256), both tag lengths
  // (64-bit = 8 bytes, 128-bit = 16), both nonce lengths (L=16 -> 13, L=64 -> 7).
  const CCM = [
    "AES-CCM-16-64-128",
    "AES-CCM-16-64-256",
    "AES-CCM-64-64-128",
    "AES-CCM-64-64-256",
    "AES-CCM-16-128-128",
    "AES-CCM-16-128-256",
    "AES-CCM-64-128-128",
    "AES-CCM-64-128-256",
  ] as const;

  test.each(CCM)("round-trips a payload through %s", (encryption) => {
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });
    const kit = new CweKit({ kryptos, logger: createMockLogger() });
    const payload = Buffer.from("the cwt claims bytes");

    const token = kit.encrypt(payload, { tokenType: "at" });
    const { payload: out } = kit.decrypt(token);

    expect(out.equals(payload)).toBe(true);
  });

  test("rejects a tampered CCM ciphertext", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "AES-CCM-16-64-128",
    });
    const kit = new CweKit({ kryptos, logger: createMockLogger() });

    const encrypt0 = decodeCbor<Tag>(kit.encrypt(Buffer.from("secret payload")));
    const arr = encrypt0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.decrypt(encodeCbor(encrypt0))).toThrow();
  });
});

describe("CweKit — proprietary alg/enc gate", () => {
  // The AES-CBC-HMAC family (RFC 7518 §5.2.3) has NO official COSE registration —
  // it is private-use. Non-proprietary encrypt refuses it; proprietary allows it.
  const CBC = ["A128CBC-HS256", "A192CBC-HS384", "A256CBC-HS512"] as const;

  test.each(CBC)("non-proprietary encrypt refuses %s (no official COSE label)", (enc) => {
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: enc });
    const kit = new CweKit({ kryptos, logger: createMockLogger() });

    const error = (() => {
      try {
        kit.encrypt(Buffer.from("the cwt claims bytes"));
      } catch (err) {
        return err as AegisError;
      }
    })();

    // ⚠ The LEAF class, not only `AegisError`. `CweError` is what this kit's
    // refusals promise, and a throw that quietly became a sibling COSE error
    // would still satisfy the base-class assertion while breaking every consumer
    // that branches on the namespace.
    expect(error).toBeInstanceOf(CweError);
    expect(error).toBeInstanceOf(AegisError);
    expect(error?.code).toBe("cose_enc_not_registered");
  });

  test.each(CBC)(
    "proprietary encrypt allows %s and round-trips (tag length %s)",
    (enc) => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: enc });
      const kit = new CweKit({ kryptos, logger: createMockLogger() });
      const payload = Buffer.from("the cwt claims bytes");

      const token = kit.encrypt(payload, { proprietary: true });

      // Decrypt is ALWAYS lenient — it reads the private-use label back with no
      // proprietary flag and reconstructs the plaintext (correct tag slice).
      const { payload: out, protectedHeader: header } = kit.decrypt(token);

      expect(out.equals(payload)).toBe(true);
      // The private-use CBC-HMAC encryption round-trips to its wire enc name.
      expect(header.enc).toBe(enc);
    },
  );

  test("an official encryption (A256GCM) needs no proprietary flag", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A256GCM",
    });
    const kit = new CweKit({ kryptos, logger: createMockLogger() });

    expect(() => kit.encrypt(Buffer.from("payload"))).not.toThrow();
  });
});

/**
 * ⭐ THE TOKEN-CONTROLLED HALF of the COSE label tables. `decrypt` reads the
 * content-encryption label straight off the FOREIGN protected header — a COSE
 * label is `int / tstr` (RFC 9052 §1.5), so a stranger can write a text one — and the
 * lookup table is a plain object. Indexed bare, `COSE_TO_ENC["constructor"]` is
 * the `Object` function rather than `undefined`, the "not supported" guard never
 * fires, and the function reaches `tagBytesForEncryption` where `.startsWith`
 * throws a raw TypeError straight out of the `AegisError` contract. Read through
 * `internal/cose/own-entry.ts`, the refusal is the kit's own.
 */
describe("CweKit — a protected alg label naming an Object.prototype member", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });

  test.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
    "a foreign COSE_Encrypt0 whose alg is `%s` is refused as an AegisError",
    (name) => {
      const encrypt0 = decodeCbor<Tag>(kit.encrypt(Buffer.from("secret payload")));
      const contents = encrypt0.contents as Array<unknown>;

      contents[0] = encodeProtectedHeader(
        new Map<number, unknown>([[coseByJose("alg"), name]]),
      );

      let thrown: unknown;
      try {
        kit.decrypt(encodeCbor(encrypt0));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as AegisError).code).toBe("cose_encryption_not_supported");
    },
  );
});

/**
 * ⭐ THE UNPROTECTED BUCKET IS A STRANGER'S, AND `decrypt` READS IT BEFORE THE
 * AEAD RUNS. `splitEncrypt0` types the slot `unknown` deliberately, because a
 * producer writes whatever it likes there and `preferMap: false` hands a wholly
 * text-keyed CBOR map back as a plain object. `decrypt` cast it to `Map` and
 * called `.get`, so the token escaped as a raw `TypeError` — outside the
 * `AegisError` contract a caller catches on.
 *
 * `decode` narrowed the same slot correctly all along, so the two read verbs
 * disagreed about one token: a rule enforced at one door and not its twin.
 */
describe("CweKit — a COSE_Encrypt0 whose unprotected bucket is not a map", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });

  const withUnprotected = (unprotected: unknown): Buffer => {
    const encrypt0 = decodeCbor<Tag>(kit.encrypt(Buffer.from("secret payload")));
    (encrypt0.contents as Array<unknown>)[1] = unprotected;
    return Buffer.from(encodeCbor(encrypt0));
  };

  test.each([
    ["an integer", 7],
    ["a text string", "not-a-map"],
    ["an array", []],
    ["a byte string", Buffer.alloc(2)],
  ])("decrypt refuses it as an AegisError when it is %s", (_name, unprotected) => {
    let thrown: unknown;
    try {
      kit.decrypt(withUnprotected(unprotected));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CweError);
    expect((thrown as CweError).code).toBe("cose_malformed");
  });

  // The twin door has always narrowed, and it must keep answering the same token
  // the same way: no IV to report, no throw.
  test.each([
    ["an integer", 7],
    ["a text string", "not-a-map"],
  ])("decode reads it as an empty unprotected bucket when it is %s", (_name, bucket) => {
    expect(CweKit.decode(withUnprotected(bucket)).unprotectedHeader).toEqual({});
  });
});

// ⛔ A STRUCTURALLY malformed foreign token must be refused as an `AegisError`,
// BEFORE any cryptography is spent: a consumer branches on it to answer 401, so a
// raw `TypeError` — or a leaf error from `@lindorm/aes` reached with fabricated
// bytes — is a 500 for a token that should simply have been rejected.
//
// ⚠ The AEAD VERDICT is deliberately NOT in that contract: a ciphertext of legal
// length that fails to authenticate answers `AesError decryption_failed`, pinned
// by "rejects tampered ciphertext" above. This describe covers only what is
// refused before the AEAD runs.
describe("CweKit — a slot holding something other than a byte string", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });
  const token = kit.encrypt(Buffer.from("the plaintext"));

  // ⚠ THE TSTR IS LONGER THAN THE 16-BYTE A256GCM TAG, and that length is what
  // makes the ciphertext row below discriminate: `decrypt` runs a TYPE gate and
  // then a LENGTH gate, both answering `cose_malformed`, so a text string shorter
  // than the tag stays green over a missing type gate. At this length a missing
  // type gate reaches `AesKit` instead — outside the `AegisError` contract.
  const NOT_BSTR: Array<[string, unknown]> = [
    ["nil", null],
    ["an int", 42],
    ["a tstr", "a text string longer than the sixteen-byte A256GCM tag"],
  ];

  // The protected bucket carries bytes (RFC 9052 §3) and those bytes are the
  // `Enc_structure` slot that makes it this message's AAD (RFC 9052 §5.3,
  // `buildEncStructure`), so neither door has a reading for a slot holding no bytes.
  test.each(NOT_BSTR)(
    "decrypt refuses %s protected header inside the contract",
    (_name, value) => {
      let thrown: unknown;

      try {
        kit.decrypt(spliceCoseSlot(token, 0, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CweError).code).toBe("cose_malformed");
    },
  );

  test.each(NOT_BSTR)(
    "decode refuses %s protected header inside the contract",
    (_name, value) => {
      let thrown: unknown;

      try {
        CweKit.decode(spliceCoseSlot(token, 0, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CweError).code).toBe("cose_malformed");
    },
  );

  test.each(NOT_BSTR)(
    "decrypt refuses %s ciphertext inside the contract",
    (_name, value) => {
      let thrown: unknown;

      try {
        kit.decrypt(spliceCoseSlot(token, 2, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CweError).code).toBe("cose_malformed");
      // The TYPE gate's words, so the row cannot be satisfied by the LENGTH gate
      // that shares its code.
      expect((thrown as CweError).details).toBe(
        "The COSE_Encrypt0 ciphertext slot is not a byte string, so there is nothing to decrypt.",
      );
    },
  );

  // ⚠ RFC 9052 §5.2. `decode` reads headers only, so a detached-ciphertext token
  // must stay readable through it — the ciphertext gate belongs to `decrypt`,
  // which has to AEAD the bytes.
  test("decode still reads a DETACHED (nil) ciphertext", () => {
    const detached = spliceCoseSlot(token, 2, null);

    expect(CweKit.decode(detached).protectedHeader.enc).toBe("A256GCM");
  });

  // The protected bucket is `bstr .cbor header_map` (RFC 9052 §3) and `requireBstr`
  // reaches only the outer `bstr`. `decodeProtectedHeader` (`structures.ts`) is
  // where the inner half is enforced, and both doors read it.
  test.each([
    ["an int", encodeCbor(42)],
    ["an array", encodeCbor([1, 2])],
    ["nil", encodeCbor(null)],
    ["a tstr", encodeCbor("hi")],
  ])("both doors refuse a protected byte string holding %s", (_name, bstr) => {
    for (const door of [
      () => kit.decrypt(spliceCoseSlot(token, 0, bstr)),
      () => CweKit.decode(spliceCoseSlot(token, 0, bstr)),
    ]) {
      let thrown: unknown;

      try {
        door();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CweError).code).toBe("cose_malformed");
    }
  });

  // ⚠ A ciphertext slot SHORTER than the AEAD tag has no tag to split off, and the
  // split fabricates one from whatever is there: without the length gate in
  // `CweKit.decrypt`, `AesKit` answers `AesError invalid_auth_tag_length` — a leaf
  // error from `@lindorm/aes`, not an `AegisError`.
  test.each([
    ["empty", Buffer.alloc(0)],
    ["4 bytes", Buffer.alloc(4)],
    ["15 bytes — one short of the A256GCM tag", Buffer.alloc(15)],
  ])("decrypt refuses a ciphertext of %s inside the contract", (_name, value) => {
    let thrown: unknown;

    try {
      kit.decrypt(spliceCoseSlot(token, 2, value));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as CweError).code).toBe("cose_malformed");
  });

  // ⚠ THE WORDS. Both ciphertext refusals share the `cose_malformed` code with each
  // other and with `splitEncrypt0`'s two, so every row above stays green over a
  // gate that reports the wrong one — and the length sentence is the only place the
  // reader is told the tag size the slot fell short of.
  test.each([
    [
      "the TYPE refusal names the slot",
      () => kit.decrypt(spliceCoseSlot(token, 2, 42)),
      "The COSE_Encrypt0 ciphertext slot is not a byte string, so there is nothing to decrypt.",
    ],
    [
      "the LENGTH refusal names the tag it fell short of",
      () => kit.decrypt(spliceCoseSlot(token, 2, Buffer.alloc(15))),
      "The COSE_Encrypt0 ciphertext slot is shorter than the 16-byte A256GCM authentication tag, so it carries no tag to verify.",
    ],
  ])("%s", (_name, door, details) => {
    let thrown: unknown;

    try {
      door();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CweError);
    expect((thrown as CweError).code).toBe("cose_malformed");
    expect((thrown as CweError).details).toBe(details);
  });

  // ⚠ What fixes that gate at `<` rather than `<=`: an EMPTY plaintext encrypts to
  // a ciphertext of EXACTLY the tag length, so a `<=` gate would refuse a token
  // this kit itself mints.
  test("encrypts and decrypts an EMPTY plaintext", () => {
    expect(kit.decrypt(kit.encrypt(Buffer.alloc(0))).payload).toHaveLength(0);
  });

  // ⚠ Slot 1 is NOT a byte-string slot — it is the unprotected bucket, and on a
  // COSE_Encrypt0 it carries the IV, so narrowing it to a `Map` costs the IV and
  // `decrypt` refuses (pinned by "CweKit — a COSE_Encrypt0 whose unprotected
  // bucket is not a map" above). `decode` needs nothing from it, and the protected
  // bucket it does read is unaffected.
  test.each(NOT_BSTR)(
    "decode still reads the protected header when the unprotected bucket is %s",
    (_name, value) => {
      expect(CweKit.decode(spliceCoseSlot(token, 1, value)).protectedHeader.enc).toBe(
        "A256GCM",
      );
    },
  );
});
