import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { ProteusError } from "../../../errors/index.js";
import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../types/metadata.js";
import { validateEncryptedFields } from "./validate-encrypted-fields.js";
import { describe, expect, test } from "vitest";

const createMetadata = (fields: ReturnType<typeof makeField>[]): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields,
    primaryKeys: ["id"],
  }) as unknown as EntityMetadata;

describe("validateEncryptedFields", () => {
  test("should not throw when no encrypted fields exist", () => {
    const metadata = createMetadata([makeField("id"), makeField("name")]);
    expect(() => validateEncryptedFields([metadata], undefined)).not.toThrow();
  });

  test("should not throw when encrypted fields exist and amphora is provided", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("secret", { encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).not.toThrow();
  });

  test("should throw when encrypted field exists but amphora is undefined", () => {
    const metadata = createMetadata([
      makeField("id"),
      makeField("secret", { encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], undefined)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], undefined)).toThrow(
      /TestEntity.*secret.*no amphora/,
    );
  });

  test("should throw when @Encrypted used on primary key field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id", { encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /primary key.*"id".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on Version field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("version", { decorator: "Version", encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /Version.*"version".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on CreateDate field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("createdAt", { decorator: "CreateDate", encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /CreateDate.*"createdAt".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on UpdateDate field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("updatedAt", { decorator: "UpdateDate", encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /UpdateDate.*"updatedAt".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on DeleteDate field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("deletedAt", { decorator: "DeleteDate", encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /DeleteDate.*"deletedAt".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on ExpiryDate field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("expiresAt", { decorator: "ExpiryDate", encrypted: { predicate: null } }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /ExpiryDate.*"expiresAt".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on VersionStartDate field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("versionStart", {
        decorator: "VersionStartDate",
        encrypted: { predicate: null },
      }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /VersionStartDate.*"versionStart".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on VersionEndDate field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("versionEnd", {
        decorator: "VersionEndDate",
        encrypted: { predicate: null },
      }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /VersionEndDate.*"versionEnd".*TestEntity/,
    );
  });

  test("should throw when @Encrypted used on computed field", () => {
    const amphora = createMockAmphora();
    const metadata = createMetadata([
      makeField("id"),
      makeField("computed", {
        computed: "col_a + col_b",
        encrypted: { predicate: null },
      }),
    ]);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(ProteusError);
    expect(() => validateEncryptedFields([metadata], amphora)).toThrow(
      /computed.*"computed".*TestEntity/,
    );
  });
});
