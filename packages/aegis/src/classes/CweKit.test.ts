import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { decodeProtectedHeader } from "../internal/cose/structures.js";
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
    const { payload: out, header } = kit.decrypt(token);

    expect(out.equals(payload)).toBe(true);
    expect(header.enc).toBe("A256GCM"); // A256GCM wire enc name
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

  test("places header params protected and unprotected params unprotected", () => {
    const token = kit.encrypt(Buffer.from("secret"), {
      header: { cty: "application/example" },
      unprotected: { x5u },
    });

    const { header } = kit.decrypt(token);
    expect(header.cty).toBe("application/example");
    expect(header.x5u).toBe(x5u);
    // enc (label 1, kit-computed) + kid + iv are always present.
    expect(header.enc).toBe("A256GCM");
    expect(header.kid).toBe(kryptos.id);
    expect(header.iv).toEqual(expect.any(String));

    const [protectedBstr, unprotected] = decodeCbor<Tag>(token).contents as [
      Buffer,
      Map<number, unknown>,
    ];
    const protectedMap = decodeProtectedHeader(protectedBstr);
    expect(protectedMap.has(coseByJose("cty"))).toBe(true);
    expect(protectedMap.has(coseByJose("alg"))).toBe(true); // enc sits on label 1
    expect(unprotected.has(coseByJose("x5u"))).toBe(true);
    expect(unprotected.has(coseByJose("iv"))).toBe(true);
    expect(unprotected.has(coseByJose("kid"))).toBe(true);
  });

  test("throws when the computed iv is smuggled into the unprotected bag", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), {
          unprotected: { iv: Buffer.from("nope") } as never,
        }),
      ),
    ).toBe("cose_reserved_header");
  });

  test("throws when a crit-listed param is placed unprotected", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), {
          header: { crit: ["cty"] },
          unprotected: { cty: "application/example" },
        }),
      ),
    ).toBe("cose_crit_param_unprotected");
  });

  test("throws when the same param is set in both bags", () => {
    expect(
      codeOf(() =>
        kit.encrypt(Buffer.from("secret"), {
          header: { cty: "a" },
          unprotected: { cty: "b" },
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

describe("CweKit — proprietary alg/enc gate (D5)", () => {
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
      const { payload: out, header } = kit.decrypt(token);

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
