import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { CweKit } from "./CweKit.js";

describe("CweKit (COSE_Encrypt0)", () => {
  const kryptos = KryptosKit.generate.enc.oct({
    algorithm: "dir",
    encryption: "A256GCM",
  });
  const kit = new CweKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through encrypt -> CBOR -> decrypt", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const encrypt0 = kit.encrypt(payload, { typ: "application/at+cwt" });
    const decoded = decodeCbor(encodeCbor(encrypt0));
    const { payload: out, protectedHeader } = kit.decrypt(decoded);

    expect(out.equals(payload)).toBe(true);
    expect(protectedHeader.get(1)).toBe(3); // A256GCM label
  });

  test("rejects tampered ciphertext", () => {
    const encrypt0 = kit.encrypt(Buffer.from("secret payload"));
    const arr = encrypt0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.decrypt(encrypt0)).toThrow();
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

    const encrypt0 = kit.encrypt(payload, { typ: "application/at+cwt" });
    const decoded = decodeCbor(encodeCbor(encrypt0));
    const { payload: out } = kit.decrypt(decoded);

    expect(out.equals(payload)).toBe(true);
  });

  test("rejects a tampered CCM ciphertext", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "AES-CCM-16-64-128",
    });
    const kit = new CweKit({ kryptos, logger: createMockLogger() });

    const encrypt0 = kit.encrypt(Buffer.from("secret payload"));
    const arr = encrypt0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]);
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.decrypt(encrypt0)).toThrow();
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

      const encrypt0 = kit.encrypt(payload, { proprietary: true });
      const decoded = decodeCbor(encodeCbor(encrypt0));

      // Decrypt is ALWAYS lenient — it reads the private-use label back with no
      // proprietary flag and reconstructs the plaintext (correct tag slice).
      const { payload: out, protectedHeader } = kit.decrypt(decoded);

      expect(out.equals(payload)).toBe(true);
      // The private-use CBC-HMAC label sits below the COSE private-use floor.
      expect(protectedHeader.get(1)).toBeLessThan(-65536);
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
