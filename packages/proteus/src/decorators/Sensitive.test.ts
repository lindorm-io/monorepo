import { z } from "zod";
import { ShaKit } from "@lindorm/sha";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { defaultValidateEntity } from "../internal/entity/utils/default-validate-entity.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { Nullable } from "./Nullable.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { Schema } from "./Schema.js";
import { Sensitive } from "./Sensitive.js";
import { describe, expect, test } from "vitest";

// Real digest fixtures — computed (sha) or produced by the argon2 npm lib (argon2)
const SHA256_HASH = ShaKit.S256("hunter2");
const SHA384_HASH = ShaKit.S384("hunter2");
const SHA512_HASH = ShaKit.S512("hunter2");
const MD5_HASH = "5d41402abc4b2a76b9719d911017c592"; // md5("hello")
const ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$BX32mY7d1Ze35yl60vSt8g$OzUIrSls4ygVrk4peci3Cr7VU9e7BiTkotwvaCyo6HU";

const UUID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

@Entity({ name: "SensitiveDecorated" })
class SensitiveDecorated {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Sensitive({ digest: "sha256" })
  @Field("string")
  passwordHash!: string;

  @Sensitive()
  @Field("string")
  apiToken!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "SensitiveDigests" })
class SensitiveDigests {
  @PrimaryKeyField() @Generated("uuid") id!: string;

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

@Entity({ name: "SensitiveNullable" })
class SensitiveNullable {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Nullable()
  @Sensitive({ digest: "sha256" })
  @Field("string")
  recoveryHash!: string | null;
}

const validDigests = () => ({
  id: UUID,
  sha256Hash: SHA256_HASH,
  sha384Hash: SHA384_HASH,
  sha512Hash: SHA512_HASH,
  md5Hash: MD5_HASH,
  argon2Hash: ARGON2_HASH,
});

describe("Sensitive", () => {
  describe("metadata", () => {
    test("should stage digest and bare sensitive metadata", () => {
      const meta = getEntityMetadata(SensitiveDecorated);

      expect(meta.fields.find((f) => f.key === "passwordHash")!.sensitive).toEqual({
        digest: "sha256",
      });
      expect(meta.fields.find((f) => f.key === "apiToken")!.sensitive).toEqual({
        digest: null,
      });
      expect(meta.fields.find((f) => f.key === "name")!.sensitive).toBeNull();
    });

    test("should match snapshot", () => {
      expect(getEntityMetadata(SensitiveDecorated)).toMatchSnapshot();
    });

    test("should throw for duplicate @Sensitive on one property", () => {
      @Entity({ name: "SensitiveDuplicate" })
      class SensitiveDuplicate {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Sensitive()
        @Sensitive({ digest: "sha256" })
        @Field("string")
        passwordHash!: string;
      }

      expect(() => getEntityMetadata(SensitiveDuplicate)).toThrow(
        'Duplicate @Sensitive on property "passwordHash"',
      );
    });

    test("should throw for @Sensitive without a field decorator", () => {
      @Entity({ name: "SensitiveMissingField" })
      class SensitiveMissingField {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Sensitive()
        passwordHash!: string;
      }

      expect(() => getEntityMetadata(SensitiveMissingField)).toThrow(
        '@Sensitive on property "passwordHash" requires a @Field decorator',
      );
    });
  });

  describe("type gate", () => {
    test("should throw for a digest on a non-string-family field", () => {
      @Entity({ name: "SensitiveDigestOnJson" })
      class SensitiveDigestOnJson {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Sensitive({ digest: "sha256" })
        @Field("json")
        payload!: Record<string, unknown>;
      }

      expect(() => getEntityMetadata(SensitiveDigestOnJson)).toThrow(
        '@Sensitive digest on "payload" requires a "string", "varchar", or "text" field',
      );
    });

    test("should allow a bare @Sensitive() on any field type", () => {
      @Entity({ name: "SensitiveBareOnJson" })
      class SensitiveBareOnJson {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Sensitive()
        @Field("json")
        payload!: Record<string, unknown>;
      }

      const meta = getEntityMetadata(SensitiveBareOnJson);
      expect(meta.fields.find((f) => f.key === "payload")!.sensitive).toEqual({
        digest: null,
      });
    });

    test("should throw for a digest combined with a field-level @Schema", () => {
      @Entity({ name: "SensitiveDigestWithSchema" })
      class SensitiveDigestWithSchema {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Schema(z.string())
        @Sensitive({ digest: "sha256" })
        @Field("string")
        passwordHash!: string;
      }

      expect(() => getEntityMetadata(SensitiveDigestWithSchema)).toThrow(
        '@Sensitive digest and field-level @Schema cannot be combined on "passwordHash"',
      );
    });
  });

  describe("digest format validation", () => {
    test("should accept real digests for every algorithm", () => {
      expect(() =>
        defaultValidateEntity(SensitiveDigests, validDigests() as any),
      ).not.toThrow();
    });

    test("should reject a plaintext value in a digest column", () => {
      expect(() =>
        defaultValidateEntity(SensitiveDigests, {
          ...validDigests(),
          sha256Hash: "hunter2",
        } as any),
      ).toThrow();
    });

    test("should reject a sha256 value in a sha512 column", () => {
      expect(() =>
        defaultValidateEntity(SensitiveDigests, {
          ...validDigests(),
          sha512Hash: SHA256_HASH,
        } as any),
      ).toThrow();
    });

    test("should reject a padded base64 value in a base64url column", () => {
      expect(() =>
        defaultValidateEntity(SensitiveDigests, {
          ...validDigests(),
          sha256Hash: "LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=",
        } as any),
      ).toThrow();
    });

    test("should accept an uppercase md5 value (case-insensitive)", () => {
      expect(() =>
        defaultValidateEntity(SensitiveDigests, {
          ...validDigests(),
          md5Hash: MD5_HASH.toUpperCase(),
        } as any),
      ).not.toThrow();
    });

    test("should reject a malformed argon2 PHC string", () => {
      expect(() =>
        defaultValidateEntity(SensitiveDigests, {
          ...validDigests(),
          argon2Hash: "$argon2id$v=19$t=3,m=65536,p=4$salt$hash",
        } as any),
      ).toThrow();
    });
  });

  describe("@Nullable composition", () => {
    test("should accept null on a nullable digest field", () => {
      expect(() =>
        defaultValidateEntity(SensitiveNullable, {
          id: UUID,
          recoveryHash: null,
        } as any),
      ).not.toThrow();
    });

    test("should accept a real digest on a nullable digest field", () => {
      expect(() =>
        defaultValidateEntity(SensitiveNullable, {
          id: UUID,
          recoveryHash: SHA256_HASH,
        } as any),
      ).not.toThrow();
    });

    test("should reject plaintext on a nullable digest field", () => {
      expect(() =>
        defaultValidateEntity(SensitiveNullable, {
          id: UUID,
          recoveryHash: "hunter2",
        } as any),
      ).toThrow();
    });
  });
});
