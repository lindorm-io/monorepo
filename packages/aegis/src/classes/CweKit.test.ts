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

  test("rejects tampered ciphertext", () => {
    const encrypt0 = decodeCbor<Tag>(kit.encrypt(Buffer.from("secret payload")));
    const arr = encrypt0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.decrypt(encodeCbor(encrypt0))).toThrow();
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
 * content-encryption label straight off the FOREIGN protected header — RFC 9052
 * §1.5 admits `int / tstr` there, so a stranger can write a text label — and the
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
