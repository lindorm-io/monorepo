import type { EntityMetadata } from "#internal/entity/types/metadata";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError";
import {
  guardDeleteDateField,
  guardExpiryDateField,
  guardVersionFields,
  guardUpsertBlocked,
  validateRelationNames,
} from "./repository-guards";

const makeMetadata = (overrides: Partial<EntityMetadata> = {}): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields: [],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
    ...overrides,
  }) as unknown as EntityMetadata;

describe("guardDeleteDateField", () => {
  test("does not throw when DeleteDate field exists", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "DeleteDate", key: "deletedAt" }] as any,
    });
    expect(() => guardDeleteDateField(metadata, "softDestroy")).not.toThrow();
  });

  test("throws ProteusRepositoryError when DeleteDate field is missing", () => {
    const metadata = makeMetadata({ fields: [] });
    expect(() => guardDeleteDateField(metadata, "softDestroy")).toThrow(
      ProteusRepositoryError,
    );
  });

  test("includes method name and entity name in error message", () => {
    const metadata = makeMetadata({ fields: [] });
    expect(() => guardDeleteDateField(metadata, "softDelete")).toThrow(
      'softDelete() requires @DeleteDateField on "TestEntity"',
    );
  });
});

describe("guardExpiryDateField", () => {
  test("does not throw when ExpiryDate field exists", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "ExpiryDate", key: "expiresAt" }] as any,
    });
    expect(() => guardExpiryDateField(metadata, "ttl")).not.toThrow();
  });

  test("throws ProteusRepositoryError when ExpiryDate field is missing", () => {
    const metadata = makeMetadata({ fields: [] });
    expect(() => guardExpiryDateField(metadata, "ttl")).toThrow(ProteusRepositoryError);
  });

  test("includes method name and entity name in error message", () => {
    const metadata = makeMetadata({ fields: [] });
    expect(() => guardExpiryDateField(metadata, "deleteExpired")).toThrow(
      'deleteExpired() requires @ExpiryDateField on "TestEntity"',
    );
  });
});

describe("guardVersionFields", () => {
  test("does not throw when both version fields exist", () => {
    const metadata = makeMetadata({
      fields: [
        { decorator: "VersionStartDate", key: "versionStart" },
        { decorator: "VersionEndDate", key: "versionEnd" },
      ] as any,
    });
    expect(() => guardVersionFields(metadata, "versions")).not.toThrow();
  });

  test("throws when VersionStartDate is missing", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "VersionEndDate", key: "versionEnd" }] as any,
    });
    expect(() => guardVersionFields(metadata, "versions")).toThrow(
      ProteusRepositoryError,
    );
  });

  test("throws when VersionEndDate is missing", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "VersionStartDate", key: "versionStart" }] as any,
    });
    expect(() => guardVersionFields(metadata, "versions")).toThrow(
      ProteusRepositoryError,
    );
  });

  test("throws when both version fields are missing", () => {
    const metadata = makeMetadata({ fields: [] });
    expect(() => guardVersionFields(metadata, "versions")).toThrow(
      'versions() requires @VersionStartDateField and @VersionEndDateField on "TestEntity"',
    );
  });
});

describe("guardUpsertBlocked", () => {
  test("does not throw for non-versioned entity without increment PK", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "Column", key: "name" }] as any,
      generated: [],
    });
    expect(() => guardUpsertBlocked(metadata)).not.toThrow();
  });

  test("throws for entity with VersionStartDate", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "VersionStartDate", key: "versionStart" }] as any,
    });
    expect(() => guardUpsertBlocked(metadata)).toThrow(
      'upsert() is not supported on versioned entity "TestEntity"',
    );
  });

  test("throws for entity with VersionEndDate", () => {
    const metadata = makeMetadata({
      fields: [{ decorator: "VersionEndDate", key: "versionEnd" }] as any,
    });
    expect(() => guardUpsertBlocked(metadata)).toThrow(
      'upsert() is not supported on versioned entity "TestEntity"',
    );
  });

  test("throws for entity with auto-increment primary key", () => {
    const metadata = makeMetadata({
      fields: [],
      primaryKeys: ["id"],
      generated: [{ key: "id", strategy: "increment" }] as any,
    });
    expect(() => guardUpsertBlocked(metadata)).toThrow(
      'upsert() is not supported on entity "TestEntity" with auto-increment primary key',
    );
  });

  test("does not throw for increment on non-PK field", () => {
    const metadata = makeMetadata({
      fields: [],
      primaryKeys: ["id"],
      generated: [{ key: "seqNum", strategy: "increment" }] as any,
    });
    expect(() => guardUpsertBlocked(metadata)).not.toThrow();
  });
});

describe("validateRelationNames", () => {
  test("does not throw for valid relation names", () => {
    const metadata = makeMetadata({
      relations: [{ key: "tags" }, { key: "author" }] as any,
    });
    expect(() => validateRelationNames(metadata, ["tags", "author"])).not.toThrow();
  });

  test("does not throw for empty names array", () => {
    const metadata = makeMetadata({ relations: [] });
    expect(() => validateRelationNames(metadata, [])).not.toThrow();
  });

  test("throws ProteusRepositoryError for unknown relation name", () => {
    const metadata = makeMetadata({
      relations: [{ key: "tags" }] as any,
    });
    expect(() => validateRelationNames(metadata, ["nonexistent"])).toThrow(
      ProteusRepositoryError,
    );
  });

  test("includes unknown name and available names in error message", () => {
    const metadata = makeMetadata({
      relations: [{ key: "tags" }, { key: "author" }] as any,
    });
    expect(() => validateRelationNames(metadata, ["foo"])).toThrow(
      'Unknown relation "foo" on "TestEntity". Available: [tags, author]',
    );
  });
});
