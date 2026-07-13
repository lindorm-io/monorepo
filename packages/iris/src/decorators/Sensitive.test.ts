import { z } from "zod";
import { describe, expect, it } from "vitest";
import { IrisMetadataError } from "../errors/index.js";
import { buildMessageMetadata } from "../internal/message/metadata/build-message-metadata.js";
import { buildSchema } from "../internal/message/utils/build-schema.js";
import { Field } from "./Field.js";
import { Header } from "./Header.js";
import { Message } from "./Message.js";
import { Nullable } from "./Nullable.js";
import { Schema } from "./Schema.js";
import { Sensitive } from "./Sensitive.js";

// Real digest fixtures — the SHA values are ShaKit output (unpadded base64url) for
// "hunter2"; the argon2 value is a strict PHC string from the argon2 npm lib.
const SHA256_HASH = "9S-9MrKzuG_4jvbEkGKChfSCrxXdyylUH5S89Saj9sc";
const SHA384_HASH = "myHEV67XVpgzsj3wQWgN66E51a9m-7ZKhBMWV4xFNMmMzQQh6fEOpLBbuxH4C0ak";
const SHA512_HASH =
  "a5ftaNFOs_GqlZzl1Jx9xhLh6x2v1zsecFhHSD_WpsgJ8s606N9v-ZhMYpj_AoXKzmYUv42qnwBwEBtsiYmeIg";
const MD5_HASH = "5d41402abc4b2a76b9719d911017c592"; // md5("hello")
const ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$BX32mY7d1Ze35yl60vSt8g$OzUIrSls4ygVrk4peci3Cr7VU9e7BiTkotwvaCyo6HU";

@Message({ name: "SensitiveDecorated" })
class SensitiveDecorated {
  @Sensitive({ digest: "sha256" })
  @Field("string")
  passwordHash!: string;

  @Sensitive()
  @Field("string")
  apiToken!: string;

  @Field("string")
  name!: string;
}

@Message({ name: "SensitiveDigests" })
class SensitiveDigests {
  @Sensitive({ digest: "sha256" })
  @Field("string")
  sha256Hash!: string;

  @Sensitive({ digest: "sha384" })
  @Field("string")
  sha384Hash!: string;

  @Sensitive({ digest: "sha512" })
  @Field("string")
  sha512Hash!: string;

  @Sensitive({ digest: "md5" })
  @Field("string")
  md5Hash!: string;

  @Sensitive({ digest: "argon2" })
  @Field("string")
  argon2Hash!: string;
}

@Message({ name: "SensitiveNullableMsg" })
class SensitiveNullableMsg {
  @Nullable()
  @Sensitive({ digest: "sha256" })
  @Field("string")
  recoveryHash!: string | null;
}

const validDigests = () => ({
  sha256Hash: SHA256_HASH,
  sha384Hash: SHA384_HASH,
  sha512Hash: SHA512_HASH,
  md5Hash: MD5_HASH,
  argon2Hash: ARGON2_HASH,
});

const parse = (target: Function, data: unknown) =>
  z.safeParse(buildSchema(buildMessageMetadata(target)), data);

describe("Sensitive", () => {
  describe("metadata", () => {
    it("should stage the field modifier", () => {
      class TestMsg {
        @Sensitive({ digest: "sha256" })
        @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
        passwordHash!: string;
      }

      const meta = (TestMsg as any)[Symbol.metadata];
      expect(meta.fieldModifiers).toHaveLength(1);
      expect(meta.fieldModifiers[0]).toMatchSnapshot();
    });

    it("should stage a fully-resolved null digest for a bare @Sensitive", () => {
      class BareMsg {
        @Sensitive()
        @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
        apiToken!: string;
      }

      const meta = (BareMsg as any)[Symbol.metadata];
      expect(meta.fieldModifiers[0]).toMatchSnapshot();
    });

    it("should merge digest and bare sensitive metadata into the fields", () => {
      const meta = buildMessageMetadata(SensitiveDecorated);

      expect(meta.fields).toMatchSnapshot();
    });

    it("should default sensitive to null when the decorator is absent", () => {
      const meta = buildMessageMetadata(SensitiveDecorated);

      expect(meta.fields.find((f) => f.key === "name")!.sensitive).toBeNull();
    });

    it("should reject a duplicate @Sensitive on the same property", () => {
      @Message({ name: "SensitiveDuplicate" })
      class SensitiveDuplicate {
        @Sensitive()
        @Sensitive({ digest: "sha256" })
        @Field("string")
        token!: string;
      }

      expect(() => buildMessageMetadata(SensitiveDuplicate)).toThrow(IrisMetadataError);
      expect(() => buildMessageMetadata(SensitiveDuplicate)).toThrow(
        /Duplicate @Sensitive on property "token"/,
      );
    });

    it("should reject @Sensitive on a property without @Field", () => {
      @Message({ name: "SensitiveNoField" })
      class SensitiveNoField {
        @Sensitive()
        orphan!: string;
      }

      expect(() => buildMessageMetadata(SensitiveNoField)).toThrow(
        /@Sensitive on property "orphan" requires a @Field decorator/,
      );
    });
  });

  describe("type gate", () => {
    it("should reject a digest on a non-string field", () => {
      @Message({ name: "SensitiveBadType" })
      class SensitiveBadType {
        @Sensitive({ digest: "sha256" })
        @Field("integer")
        count!: number;
      }

      expect(() => buildMessageMetadata(SensitiveBadType)).toThrow(IrisMetadataError);
      expect(() => buildMessageMetadata(SensitiveBadType)).toThrow(
        /@Sensitive digest on "count" requires a "string" field/,
      );
    });

    it("should allow a bare @Sensitive on any field type", () => {
      @Message({ name: "SensitiveAnyType" })
      class SensitiveAnyType {
        @Sensitive()
        @Field("integer")
        pin!: number;

        @Sensitive()
        @Field("object")
        blob!: Record<string, unknown>;

        @Sensitive()
        @Field("date")
        bornOn!: Date;
      }

      const meta = buildMessageMetadata(SensitiveAnyType);

      expect(meta.fields.every((f) => f.sensitive?.digest === null)).toBe(true);
    });

    it("should reject a digest combined with a field-level @Schema", () => {
      @Message({ name: "SensitiveSchemaConflict" })
      class SensitiveSchemaConflict {
        @Schema(z.string())
        @Sensitive({ digest: "sha256" })
        @Field("string")
        tokenHash!: string;
      }

      expect(() => buildMessageMetadata(SensitiveSchemaConflict)).toThrow(
        /@Sensitive digest and field-level @Schema cannot be combined on "tokenHash"/,
      );
    });

    it("should allow a bare @Sensitive combined with a field-level @Schema", () => {
      @Message({ name: "SensitiveSchemaBare" })
      class SensitiveSchemaBare {
        @Schema(z.string().min(4))
        @Sensitive()
        @Field("string")
        token!: string;
      }

      expect(parse(SensitiveSchemaBare, { token: "abcd" }).success).toBe(true);
      expect(parse(SensitiveSchemaBare, { token: "ab" }).success).toBe(false);
    });
  });

  describe("digest format validation", () => {
    it("should accept real digests of every supported algorithm", () => {
      expect(parse(SensitiveDigests, validDigests()).success).toBe(true);
    });

    it("should accept an uppercase md5 digest", () => {
      expect(
        parse(SensitiveDigests, {
          ...validDigests(),
          md5Hash: MD5_HASH.toUpperCase(),
        }).success,
      ).toBe(true);
    });

    it.each([
      ["sha256Hash", "hunter2"],
      ["sha384Hash", "hunter2"],
      ["sha512Hash", "hunter2"],
      ["md5Hash", "hunter2"],
      ["argon2Hash", "hunter2"],
    ])("should reject plaintext in the %s field", (key, plaintext) => {
      expect(
        parse(SensitiveDigests, { ...validDigests(), [key]: plaintext }).success,
      ).toBe(false);
    });

    it("should reject a sha256 digest in a sha512 field (wrong length)", () => {
      expect(
        parse(SensitiveDigests, { ...validDigests(), sha512Hash: SHA256_HASH }).success,
      ).toBe(false);
    });

    it("should reject a sha512 digest in a sha256 field (wrong length)", () => {
      expect(
        parse(SensitiveDigests, { ...validDigests(), sha256Hash: SHA512_HASH }).success,
      ).toBe(false);
    });

    it("should reject a base64 (non-base64url) sha256 digest", () => {
      // 43 chars but with the standard-base64 alphabet, which ShaKit never emits
      const base64 = `${SHA256_HASH.slice(0, 41)}+/`;

      expect(
        parse(SensitiveDigests, { ...validDigests(), sha256Hash: base64 }).success,
      ).toBe(false);
    });

    it("should reject a non-hex md5 digest of the right length", () => {
      expect(
        parse(SensitiveDigests, { ...validDigests(), md5Hash: "z".repeat(32) }).success,
      ).toBe(false);
    });

    it("should reject a bcrypt hash in an argon2 field", () => {
      expect(
        parse(SensitiveDigests, {
          ...validDigests(),
          argon2Hash: "$2b$12$K3JNi5wG.Ijg8HkP5yQmO.9m6M9L1YQxq8m4KO6hIH5ROKzUJXhFa",
        }).success,
      ).toBe(false);
    });

    it("should compose the digest check with @Nullable", () => {
      expect(parse(SensitiveNullableMsg, { recoveryHash: null }).success).toBe(true);
      expect(parse(SensitiveNullableMsg, { recoveryHash: SHA256_HASH }).success).toBe(
        true,
      );
      expect(parse(SensitiveNullableMsg, { recoveryHash: "hunter2" }).success).toBe(
        false,
      );
    });
  });

  describe("headers", () => {
    it("should mark a @Header property as sensitive", () => {
      @Message({ name: "SensitiveHeaderMsg" })
      class SensitiveHeaderMsg {
        @Sensitive()
        @Header("authorization")
        @Field("string")
        auth!: string;
      }

      const meta = buildMessageMetadata(SensitiveHeaderMsg);

      // a @Header property is required to carry a @Field, so it is redacted by the
      // same flat field walk — no separate header handling needed
      expect(meta.headers).toHaveLength(1);
      expect(meta.fields.find((f) => f.key === "auth")!.sensitive).toEqual({
        digest: null,
      });
    });
  });
});
