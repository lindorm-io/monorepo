import { createCipheriv, randomBytes } from "crypto";
import { gcm, cbc, aeskw } from "@noble/ciphers/aes";
import { encryptAes, decryptAes } from "../src/utils/private/encryption";
import { ecbKeyWrap, ecbKeyUnwrap } from "../src/utils/private/key-wrap/ecb-key-wrap";
import { toUint8Array, toBuffer } from "./helpers/buffer-utils";
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

const GCM_TAG_LENGTH = 16;
const GCM_IV_LENGTH = 12;
const AES_BLOCK_SIZE = 16;

// ---------------------------------------------------------------------------
// 3.1 AES-GCM Cross-Reference
// ---------------------------------------------------------------------------

describe("AES-GCM cross-reference with @noble/ciphers", () => {
  describe.each([
    { name: "A128GCM", key: RAW_KEY_128, encryption: "A128GCM" as const },
    { name: "A192GCM", key: RAW_KEY_192, encryption: "A192GCM" as const },
    { name: "A256GCM", key: RAW_KEY_256, encryption: "A256GCM" as const },
  ])("$name", ({ key, encryption }) => {
    const plaintext = "test plaintext";

    test("our encryptAes -> noble gcm decrypt", () => {
      const kryptos = createOctKryptos(key, "dir", encryption);

      const record = encryptAes({ data: plaintext, encryption, kryptos });

      const iv = toUint8Array(record.initialisationVector);
      const ciphertext = toUint8Array(record.content);
      const tag = toUint8Array(record.authTag);

      // noble expects ciphertext || tag concatenated
      const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
      ciphertextWithTag.set(ciphertext, 0);
      ciphertextWithTag.set(tag, ciphertext.length);

      const decrypted = gcm(toUint8Array(key), iv).decrypt(ciphertextWithTag);
      const result = new TextDecoder().decode(decrypted);

      expect(result).toBe(plaintext);
    });

    test("noble gcm encrypt -> our decryptAes", () => {
      const kryptos = createOctKryptos(key, "dir", encryption);
      const iv = randomBytes(GCM_IV_LENGTH);
      const plaintextBytes = new TextEncoder().encode(plaintext);

      const encrypted = gcm(toUint8Array(key), toUint8Array(iv)).encrypt(plaintextBytes);

      // noble returns ciphertext || tag (last 16 bytes are the auth tag)
      const ciphertext = toBuffer(encrypted.slice(0, -GCM_TAG_LENGTH));
      const authTag = toBuffer(encrypted.slice(-GCM_TAG_LENGTH));

      const result = decryptAes({
        content: ciphertext,
        authTag,
        initialisationVector: iv,
        encryption,
        contentType: "text/plain",
        kryptos,
      });

      expect(result).toBe(plaintext);
    });

    test("byte-identical ciphertext with pinned IV", () => {
      const iv = Buffer.alloc(GCM_IV_LENGTH, 0xab);
      const plaintextBytes = Buffer.from(plaintext, "utf8");

      // Our side: raw Node.js createCipheriv
      const cipher = createCipheriv(
        `aes-${key.length * 8}-gcm` as "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm",
        key,
        iv,
        { authTagLength: GCM_TAG_LENGTH },
      );
      const ourCiphertext = Buffer.concat([
        cipher.update(plaintextBytes),
        cipher.final(),
      ]);
      const ourTag = cipher.getAuthTag();

      // Noble side
      const nobleResult = gcm(toUint8Array(key), toUint8Array(iv)).encrypt(
        toUint8Array(plaintextBytes),
      );
      const nobleCiphertext = nobleResult.slice(0, -GCM_TAG_LENGTH);
      const nobleTag = nobleResult.slice(-GCM_TAG_LENGTH);

      expect(ourCiphertext.equals(toBuffer(nobleCiphertext))).toBe(true);
      expect(ourTag.equals(toBuffer(nobleTag))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 3.2 AES-KW (RFC 3394) Cross-Reference
// ---------------------------------------------------------------------------

describe("AES-KW cross-reference with @noble/ciphers", () => {
  describe.each([
    { name: "A128KW", kek: KEK_128, algorithm: "A128KW" as const },
    { name: "A192KW", kek: KEK_192, algorithm: "A192KW" as const },
    { name: "A256KW", kek: KEK_256, algorithm: "A256KW" as const },
  ])("$name", ({ kek, algorithm }) => {
    // CEK to wrap: 32 bytes (suitable for A256GCM)
    const cek = randomBytes(32);

    test("our ecbKeyWrap -> noble aeskw decrypt", () => {
      const kryptos = createOctKryptos(kek, algorithm);

      const { publicEncryptionKey } = ecbKeyWrap({
        contentEncryptionKey: cek,
        keyEncryptionKey: kek,
        kryptos,
      });

      const unwrapped = aeskw(toUint8Array(kek)).decrypt(
        toUint8Array(publicEncryptionKey),
      );

      expect(cek.equals(toBuffer(unwrapped))).toBe(true);
    });

    test("noble aeskw encrypt -> our ecbKeyUnwrap", () => {
      const kryptos = createOctKryptos(kek, algorithm);

      const wrapped = aeskw(toUint8Array(kek)).encrypt(toUint8Array(cek));

      const { contentEncryptionKey } = ecbKeyUnwrap({
        keyEncryptionKey: kek,
        kryptos,
        publicEncryptionKey: toBuffer(wrapped),
      });

      expect(cek.equals(contentEncryptionKey)).toBe(true);
    });

    test("byte-identical wrapped key (deterministic)", () => {
      const kryptos = createOctKryptos(kek, algorithm);

      const { publicEncryptionKey } = ecbKeyWrap({
        contentEncryptionKey: cek,
        keyEncryptionKey: kek,
        kryptos,
      });

      const nobleWrapped = aeskw(toUint8Array(kek)).encrypt(toUint8Array(cek));

      expect(publicEncryptionKey.equals(toBuffer(nobleWrapped))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 3.3 AES-CBC Raw Cross-Reference
// ---------------------------------------------------------------------------

describe("AES-CBC raw cross-reference with @noble/ciphers", () => {
  describe.each([
    {
      name: "A128CBC",
      // A128CBC-HS256: 32B CEK -> first 16B = HMAC key, last 16B = AES-128-CBC key
      encKey: RAW_KEY_256_CBC.subarray(16),
      nodeCipher: "aes-128-cbc" as const,
    },
    {
      name: "A192CBC",
      // A192CBC-HS384: 48B CEK -> first 24B = HMAC key, last 24B = AES-192-CBC key
      encKey: RAW_KEY_384_CBC.subarray(24),
      nodeCipher: "aes-192-cbc" as const,
    },
    {
      name: "A256CBC",
      // A256CBC-HS512: 64B CEK -> first 32B = HMAC key, last 32B = AES-256-CBC key
      encKey: RAW_KEY_512_CBC.subarray(32),
      nodeCipher: "aes-256-cbc" as const,
    },
  ])("$name", ({ encKey, nodeCipher }) => {
    test("byte-identical ciphertext (PKCS7 padding)", () => {
      const iv = Buffer.alloc(AES_BLOCK_SIZE, 0xcd);
      const plaintext = Buffer.from("cross-reference CBC test", "utf8");

      // Our side: raw Node.js createCipheriv
      const cipher = createCipheriv(nodeCipher, encKey, iv);
      const ourCiphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

      // Noble side
      const nobleCiphertext = cbc(toUint8Array(encKey), toUint8Array(iv)).encrypt(
        toUint8Array(plaintext),
      );

      expect(ourCiphertext.equals(toBuffer(nobleCiphertext))).toBe(true);
    });
  });
});
