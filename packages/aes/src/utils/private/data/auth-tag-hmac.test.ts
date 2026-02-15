import { KryptosEncryption } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { assertHmacAuthTag, createHmacAuthTag } from "./auth-tag-hmac";

describe("createHmacAuthTag", () => {
  test.each<[KryptosEncryption, number, number]>([
    ["A128CBC-HS256", 16, 16], // SHA256 = 32 bytes / 2 = 16
    ["A192CBC-HS384", 24, 24], // SHA384 = 48 bytes / 2 = 24
    ["A256CBC-HS512", 32, 32], // SHA512 = 64 bytes / 2 = 32
  ])(
    "should return correct tag length for %s (hashKey: %i bytes, tag: %i bytes)",
    (encryption, hashKeySize, expectedTagLength) => {
      const content = randomBytes(64);
      const hashKey = randomBytes(hashKeySize);
      const initialisationVector = randomBytes(16);

      const tag = createHmacAuthTag({
        content,
        hashKey,
        initialisationVector,
        encryption,
      });

      expect(tag).toBeInstanceOf(Buffer);
      expect(tag.length).toBe(expectedTagLength);
    },
  );

  test("should be deterministic (same inputs produce same tag)", () => {
    const content = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const tag1 = createHmacAuthTag({
      content,
      hashKey,
      initialisationVector,
      encryption,
    });

    const tag2 = createHmacAuthTag({
      content,
      hashKey,
      initialisationVector,
      encryption,
    });

    expect(tag1).toEqual(tag2);
  });

  test("should produce different tags for different content", () => {
    const content1 = randomBytes(64);
    const content2 = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const tag1 = createHmacAuthTag({
      content: content1,
      hashKey,
      initialisationVector,
      encryption,
    });

    const tag2 = createHmacAuthTag({
      content: content2,
      hashKey,
      initialisationVector,
      encryption,
    });

    expect(tag1).not.toEqual(tag2);
  });

  test("should throw AesError for unsupported encryption", () => {
    const content = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);

    expect(() =>
      createHmacAuthTag({
        content,
        hashKey,
        initialisationVector,
        encryption: "A128GCM" as KryptosEncryption,
      }),
    ).toThrow(AesError);

    expect(() =>
      createHmacAuthTag({
        content,
        hashKey,
        initialisationVector,
        encryption: "A128GCM" as KryptosEncryption,
      }),
    ).toThrow("Unexpected algorithm");
  });
});

describe("assertHmacAuthTag", () => {
  test("should not throw when authTag matches (create then assert)", () => {
    const content = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const authTag = createHmacAuthTag({
      content,
      hashKey,
      initialisationVector,
      encryption,
    });

    expect(() =>
      assertHmacAuthTag({
        authTag,
        content,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).not.toThrow();
  });

  test.each<[KryptosEncryption, number]>([
    ["A128CBC-HS256", 16],
    ["A192CBC-HS384", 24],
    ["A256CBC-HS512", 32],
  ])(
    "should not throw when authTag matches for %s (hashKey: %i bytes)",
    (encryption, hashKeySize) => {
      const content = randomBytes(64);
      const hashKey = randomBytes(hashKeySize);
      const initialisationVector = randomBytes(16);

      const authTag = createHmacAuthTag({
        content,
        hashKey,
        initialisationVector,
        encryption,
      });

      expect(() =>
        assertHmacAuthTag({
          authTag,
          content,
          encryption,
          hashKey,
          initialisationVector,
        }),
      ).not.toThrow();
    },
  );

  test("should throw AesError when content is tampered", () => {
    const content = randomBytes(64);
    const tamperedContent = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const authTag = createHmacAuthTag({
      content,
      hashKey,
      initialisationVector,
      encryption,
    });

    expect(() =>
      assertHmacAuthTag({
        authTag,
        content: tamperedContent,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).toThrow(AesError);

    expect(() =>
      assertHmacAuthTag({
        authTag,
        content: tamperedContent,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).toThrow("Auth tag verification failed");
  });

  test("should throw AesError when authTag is wrong length", () => {
    const content = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const validAuthTag = createHmacAuthTag({
      content,
      hashKey,
      initialisationVector,
      encryption,
    });

    // Valid tag is 32 bytes, create wrong length tags
    const wrongLengthTag1 = validAuthTag.subarray(0, 16); // Too short
    const wrongLengthTag2 = Buffer.concat([validAuthTag, randomBytes(8)]); // Too long

    expect(() =>
      assertHmacAuthTag({
        authTag: wrongLengthTag1,
        content,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).toThrow(AesError);

    expect(() =>
      assertHmacAuthTag({
        authTag: wrongLengthTag2,
        content,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).toThrow(AesError);
  });

  test("should throw AesError when authTag has wrong bytes (same length)", () => {
    const content = randomBytes(64);
    const hashKey = randomBytes(32);
    const initialisationVector = randomBytes(16);
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const validAuthTag = createHmacAuthTag({
      content,
      hashKey,
      initialisationVector,
      encryption,
    });

    // Create a tag with same length but different bytes
    const wrongBytesTag = randomBytes(validAuthTag.length);

    expect(() =>
      assertHmacAuthTag({
        authTag: wrongBytesTag,
        content,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).toThrow(AesError);

    expect(() =>
      assertHmacAuthTag({
        authTag: wrongBytesTag,
        content,
        encryption,
        hashKey,
        initialisationVector,
      }),
    ).toThrow("Auth tag verification failed");
  });
});
