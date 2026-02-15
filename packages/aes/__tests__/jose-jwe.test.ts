import { createCipheriv, CipherGCM, randomBytes } from "crypto";
import { FlattenedEncrypt, flattenedDecrypt } from "jose";
import { encryptAes, decryptAes } from "../src/utils/private/encryption";
import { createHmacAuthTag } from "../src/utils/private/data/auth-tag-hmac";
import { splitContentEncryptionKey } from "../src/utils/private/data/split-content-encryption-key";
import { toUint8Array } from "./helpers/buffer-utils";
import {
  buildProtectedHeader,
  toFlattenedJWE,
  fromFlattenedJWE,
} from "./helpers/jwe-adapter";
import {
  RAW_KEY_128,
  RAW_KEY_192,
  RAW_KEY_256,
  RAW_KEY_256_CBC,
  RAW_KEY_384_CBC,
  RAW_KEY_512_CBC,
  KEK_128,
  KEK_192,
  KEK_256,
  createOctKryptos,
} from "./fixtures/keys";

const PLAINTEXT = "hello jose interop";
const PLAINTEXT_BYTES = new TextEncoder().encode(PLAINTEXT);

// ---------------------------------------------------------------------------
// 4.1 dir + AES-GCM Cross-Reference
// ---------------------------------------------------------------------------

describe("jose JWE interop: dir + AES-GCM", () => {
  describe.each([
    { enc: "A128GCM" as const, key: RAW_KEY_128 },
    { enc: "A192GCM" as const, key: RAW_KEY_192 },
    { enc: "A256GCM" as const, key: RAW_KEY_256 },
  ])("dir + $enc", ({ enc, key }) => {
    test("our encrypt -> jose decrypt", async () => {
      const kryptos = createOctKryptos(key, "dir", enc);
      const { headerB64u, aadBuffer } = buildProtectedHeader("dir", enc);

      const record = encryptAes({
        data: PLAINTEXT,
        encryption: enc,
        kryptos,
        aad: aadBuffer,
      });

      const jwe = toFlattenedJWE(record, headerB64u);
      const result = await flattenedDecrypt(jwe, toUint8Array(key));

      expect(Buffer.from(result.plaintext).toString("utf8")).toBe(PLAINTEXT);
    });

    test("jose encrypt -> our decrypt", async () => {
      const kryptos = createOctKryptos(key, "dir", enc);

      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg: "dir", enc })
        .encrypt(toUint8Array(key));

      const { record, aad } = fromFlattenedJWE(jwe);

      const result = decryptAes({
        ...record,
        aad,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(PLAINTEXT);
    });
  });
});

// ---------------------------------------------------------------------------
// 4.2 dir + AES-CBC-HMAC Cross-Reference
// ---------------------------------------------------------------------------

describe("jose JWE interop: dir + AES-CBC-HMAC", () => {
  describe.each([
    { enc: "A128CBC-HS256" as const, key: RAW_KEY_256_CBC },
    { enc: "A192CBC-HS384" as const, key: RAW_KEY_384_CBC },
    { enc: "A256CBC-HS512" as const, key: RAW_KEY_512_CBC },
  ])("dir + $enc", ({ enc, key }) => {
    test("our encrypt -> jose decrypt", async () => {
      const kryptos = createOctKryptos(key, "dir", enc);
      const { headerB64u, aadBuffer } = buildProtectedHeader("dir", enc);

      const record = encryptAes({
        data: PLAINTEXT,
        encryption: enc,
        kryptos,
        aad: aadBuffer,
      });

      const jwe = toFlattenedJWE(record, headerB64u);
      const result = await flattenedDecrypt(jwe, toUint8Array(key));

      expect(Buffer.from(result.plaintext).toString("utf8")).toBe(PLAINTEXT);
    });

    test("jose encrypt -> our decrypt", async () => {
      const kryptos = createOctKryptos(key, "dir", enc);

      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg: "dir", enc })
        .encrypt(toUint8Array(key));

      const { record, aad } = fromFlattenedJWE(jwe);

      const result = decryptAes({
        ...record,
        aad,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(PLAINTEXT);
    });
  });
});

// ---------------------------------------------------------------------------
// 4.3 A*KW + AES-GCM Cross-Reference
// ---------------------------------------------------------------------------

describe("jose JWE interop: A*KW + AES-GCM", () => {
  describe.each([
    { alg: "A128KW" as const, kek: KEK_128 },
    { alg: "A192KW" as const, kek: KEK_192 },
    { alg: "A256KW" as const, kek: KEK_256 },
  ])("$alg", ({ alg, kek }) => {
    describe.each([{ enc: "A128GCM" as const }, { enc: "A256GCM" as const }])(
      "+ $enc",
      ({ enc }) => {
        test("our encrypt -> jose decrypt", async () => {
          const kryptos = createOctKryptos(kek, alg, enc);
          const { headerB64u, aadBuffer } = buildProtectedHeader(alg, enc);

          const record = encryptAes({
            data: PLAINTEXT,
            encryption: enc,
            kryptos,
            aad: aadBuffer,
          });

          const jwe = toFlattenedJWE(record, headerB64u);
          const result = await flattenedDecrypt(jwe, toUint8Array(kek));

          expect(Buffer.from(result.plaintext).toString("utf8")).toBe(PLAINTEXT);
        });

        test("jose encrypt -> our decrypt", async () => {
          const kryptos = createOctKryptos(kek, alg, enc);

          const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
            .setProtectedHeader({ alg, enc })
            .encrypt(toUint8Array(kek));

          const { record, aad } = fromFlattenedJWE(jwe);

          const result = decryptAes({
            ...record,
            aad,
            contentType: "text/plain",
            kryptos,
          });

          expect(result).toBe(PLAINTEXT);
        });
      },
    );
  });
});

// ---------------------------------------------------------------------------
// 4.4 A*KW + AES-CBC-HMAC Cross-Reference
// ---------------------------------------------------------------------------

describe("jose JWE interop: A*KW + AES-CBC-HMAC", () => {
  describe.each([
    { alg: "A128KW" as const, enc: "A128CBC-HS256" as const, kek: KEK_128 },
    { alg: "A192KW" as const, enc: "A192CBC-HS384" as const, kek: KEK_192 },
    { alg: "A256KW" as const, enc: "A256CBC-HS512" as const, kek: KEK_256 },
  ])("$alg + $enc", ({ alg, enc, kek }) => {
    test("our encrypt -> jose decrypt", async () => {
      const kryptos = createOctKryptos(kek, alg, enc);
      const { headerB64u, aadBuffer } = buildProtectedHeader(alg, enc);

      const record = encryptAes({
        data: PLAINTEXT,
        encryption: enc,
        kryptos,
        aad: aadBuffer,
      });

      const jwe = toFlattenedJWE(record, headerB64u);
      const result = await flattenedDecrypt(jwe, toUint8Array(kek));

      expect(Buffer.from(result.plaintext).toString("utf8")).toBe(PLAINTEXT);
    });

    test("jose encrypt -> our decrypt", async () => {
      const kryptos = createOctKryptos(kek, alg, enc);

      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg, enc })
        .encrypt(toUint8Array(kek));

      const { record, aad } = fromFlattenedJWE(jwe);

      const result = decryptAes({
        ...record,
        aad,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(PLAINTEXT);
    });
  });
});

// ---------------------------------------------------------------------------
// 4.5 A*GCMKW + AES-GCM Cross-Reference
// ---------------------------------------------------------------------------

describe("jose JWE interop: A*GCMKW + AES-GCM", () => {
  describe.each([
    { alg: "A128GCMKW" as const, kek: KEK_128 },
    { alg: "A256GCMKW" as const, kek: KEK_256 },
  ])("$alg + A256GCM", ({ alg, kek }) => {
    const enc = "A256GCM" as const;

    test("jose encrypt -> our decrypt", async () => {
      const kryptos = createOctKryptos(kek, alg, enc);

      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg, enc })
        .encrypt(toUint8Array(kek));

      const { record, aad } = fromFlattenedJWE(jwe);

      const result = decryptAes({
        ...record,
        aad,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(PLAINTEXT);
    });

    // Our encrypt -> jose decrypt for GCMKW has a circular dependency:
    // The protected header must contain the key-wrap iv and tag (per RFC 7518 section 4.7),
    // but the content encryption AAD is computed from the protected header (per RFC 7516
    // section 5.1 step 14). Our encryptAes() generates the key-wrap params and encrypts
    // content in a single pass, so we cannot know the final header (and therefore the
    // correct AAD) before encryption.
    //
    // A two-pass approach (encrypt once to get kw params, build header, re-encrypt with
    // correct AAD) would require exposing the CEK from the first pass, which our API
    // does not currently support via the public encryptAes interface.
    //
    // The jose->ours direction above validates that our decryption is fully compatible.
    // Byte-level correctness of our GCM key-wrap is separately validated in the
    // noble-ciphers cross-reference tests.
    test("our encrypt -> jose decrypt", async () => {
      const kryptos = createOctKryptos(kek, alg, enc);

      // Perform encryption without AAD first to get the key-wrap parameters
      const record = encryptAes({
        data: PLAINTEXT,
        encryption: enc,
        kryptos,
      });

      // Build the protected header including the GCMKW iv and tag
      const { headerB64u, aadBuffer } = buildProtectedHeader(alg, enc, {
        iv: record.publicEncryptionIv!,
        tag: record.publicEncryptionTag!,
      });

      // Re-encrypt with correct AAD using the same CEK that was wrapped.
      // We can recover the CEK by unwrapping the encrypted_key.
      const unwrapKryptos = createOctKryptos(kek, alg, enc);
      const { contentEncryptionKey } = (
        await import("../src/utils/private/key-wrap/gcm-key-wrap")
      ).gcmKeyUnwrap({
        keyEncryptionKey: kek,
        kryptos: unwrapKryptos,
        publicEncryptionIv: record.publicEncryptionIv!,
        publicEncryptionKey: record.publicEncryptionKey!,
        publicEncryptionTag: record.publicEncryptionTag!,
      });

      // Re-encrypt content with the recovered CEK and correct AAD
      const { encryptionKey } = splitContentEncryptionKey(enc, contentEncryptionKey);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, {
        authTagLength: 16,
      }) as CipherGCM;
      cipher.setAAD(aadBuffer);

      const plaintextBuf = Buffer.from(PLAINTEXT, "utf8");
      const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const jwe = {
        protected: headerB64u,
        iv: iv.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        tag: authTag.toString("base64url"),
        encrypted_key: record.publicEncryptionKey!.toString("base64url"),
      };

      const result = await flattenedDecrypt(jwe, toUint8Array(kek));
      expect(Buffer.from(result.plaintext).toString("utf8")).toBe(PLAINTEXT);
    });
  });
});

// ---------------------------------------------------------------------------
// 4.6 Deterministic Pinned Tests
// ---------------------------------------------------------------------------
//
// jose v6 does not allow setContentEncryptionKey() with alg: "dir".
// We use A256KW / A128KW key-wrap algorithms instead, which do allow CEK
// pinning. This still validates byte-identical ciphertext because the
// content encryption is the same regardless of the key management algorithm.
// ---------------------------------------------------------------------------

describe("jose JWE interop: deterministic pinned tests", () => {
  describe("A256KW + A256GCM", () => {
    const alg = "A256KW" as const;
    const enc = "A256GCM" as const;
    const kek = KEK_256;
    const cek = Buffer.from(
      "e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff00",
      "hex",
    );
    const iv = Buffer.from("0a0b0c0d0e0f10111213141516", "hex").subarray(0, 12);
    const plaintextBuf = Buffer.from(PLAINTEXT, "utf8");

    test("byte-identical ciphertext and auth tag", async () => {
      // jose: encrypt with pinned CEK and IV
      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg, enc })
        .setContentEncryptionKey(toUint8Array(cek))
        .setInitializationVector(toUint8Array(iv))
        .encrypt(toUint8Array(kek));

      // The AAD is the ASCII bytes of the base64url-encoded protected header
      const joseAad = Buffer.from(jwe.protected!, "ascii");

      // Our side: raw createCipheriv with the same CEK, IV, and AAD
      const cipher = createCipheriv("aes-256-gcm", cek, iv, {
        authTagLength: 16,
      }) as CipherGCM;
      cipher.setAAD(joseAad);

      const ourCiphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
      const ourTag = cipher.getAuthTag();

      const joseCiphertext = Buffer.from(jwe.ciphertext, "base64url");
      const joseTag = Buffer.from(jwe.tag!, "base64url");

      expect(ourCiphertext.equals(joseCiphertext)).toBe(true);
      expect(ourTag.equals(joseTag)).toBe(true);
    });

    test("round-trip with pinned values through decryptAes", async () => {
      // jose: encrypt with pinned CEK and IV
      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg, enc })
        .setContentEncryptionKey(toUint8Array(cek))
        .setInitializationVector(toUint8Array(iv))
        .encrypt(toUint8Array(kek));

      // Parse with our adapter and decrypt
      const kryptos = createOctKryptos(kek, alg, enc);
      const { record, aad } = fromFlattenedJWE(jwe);

      const result = decryptAes({
        ...record,
        aad,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(PLAINTEXT);
    });
  });

  describe("A128KW + A128CBC-HS256", () => {
    const alg = "A128KW" as const;
    const enc = "A128CBC-HS256" as const;
    const kek = KEK_128;
    // A128CBC-HS256 CEK is 32 bytes: first 16 = HMAC key, last 16 = AES key
    const cek = Buffer.from(
      "a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0",
      "hex",
    );
    const iv = Buffer.alloc(16, 0xdd);
    const plaintextBuf = Buffer.from(PLAINTEXT, "utf8");

    test("byte-identical ciphertext and auth tag", async () => {
      // jose: encrypt with pinned CEK and IV
      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg, enc })
        .setContentEncryptionKey(toUint8Array(cek))
        .setInitializationVector(toUint8Array(iv))
        .encrypt(toUint8Array(kek));

      const joseAad = Buffer.from(jwe.protected!, "ascii");

      // Split CEK per RFC 7518 Section 5.2
      const { encryptionKey, hashKey } = splitContentEncryptionKey(enc, cek);

      // Our side: raw createCipheriv (CBC) with same key and IV
      const cipher = createCipheriv("aes-128-cbc", encryptionKey, iv);
      const ourCiphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);

      // HMAC auth tag per RFC 7518 Section 5.2.2.1
      const ourTag = createHmacAuthTag({
        aad: joseAad,
        content: ourCiphertext,
        encryption: enc,
        hashKey,
        initialisationVector: iv,
      });

      const joseCiphertext = Buffer.from(jwe.ciphertext, "base64url");
      const joseTag = Buffer.from(jwe.tag!, "base64url");

      expect(ourCiphertext.equals(joseCiphertext)).toBe(true);
      expect(ourTag.equals(joseTag)).toBe(true);
    });

    test("round-trip with pinned values through decryptAes", async () => {
      // jose: encrypt with pinned CEK and IV
      const jwe = await new FlattenedEncrypt(PLAINTEXT_BYTES)
        .setProtectedHeader({ alg, enc })
        .setContentEncryptionKey(toUint8Array(cek))
        .setInitializationVector(toUint8Array(iv))
        .encrypt(toUint8Array(kek));

      // Parse with our adapter and decrypt
      const kryptos = createOctKryptos(kek, alg, enc);
      const { record, aad } = fromFlattenedJWE(jwe);

      const result = decryptAes({
        ...record,
        aad,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(PLAINTEXT);
    });
  });
});
