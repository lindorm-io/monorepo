import type { EntityMetadata } from "../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import { buildPrimaryKeyPredicate } from "./build-pk-predicate.js";
import { describe, expect, test } from "vitest";

const makeMetadata = (primaryKeys: Array<string>): EntityMetadata =>
  ({
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "Order",
      namespace: "app",
    },
    primaryKeys,
  }) as unknown as EntityMetadata;

describe("buildPrimaryKeyPredicate", () => {
  describe("single primary key", () => {
    test("builds predicate from entity PK field", () => {
      const metadata = makeMetadata(["id"]);
      const entity = { id: "abc-123", name: "test" };
      const result = buildPrimaryKeyPredicate(entity as any, metadata);
      expect(result).toMatchSnapshot();
    });

    test("throws ProteusRepositoryError when PK field is null", () => {
      const metadata = makeMetadata(["id"]);
      const entity = { id: null, name: "test" };
      expect(() => buildPrimaryKeyPredicate(entity as any, metadata)).toThrow(
        ProteusRepositoryError,
      );
    });

    test("throws ProteusRepositoryError when PK field is undefined", () => {
      const metadata = makeMetadata(["id"]);
      const entity = { name: "test" };
      expect(() => buildPrimaryKeyPredicate(entity as any, metadata)).toThrow(
        ProteusRepositoryError,
      );
    });

    test("throws with informative message including field name and entity name", () => {
      const metadata = makeMetadata(["id"]);
      const entity = { id: null };
      expect(() => buildPrimaryKeyPredicate(entity as any, metadata)).toThrow(
        'Cannot build primary key predicate: field "id" is null or undefined on "Order"',
      );
    });
  });

  describe("composite primary key", () => {
    test("builds predicate from all PK fields", () => {
      const metadata = makeMetadata(["tenantId", "userId"]);
      const entity = { tenantId: "tenant-1", userId: "user-2", name: "test" };
      const result = buildPrimaryKeyPredicate(entity as any, metadata);
      expect(result).toMatchSnapshot();
    });

    test("throws when first PK field is null", () => {
      const metadata = makeMetadata(["tenantId", "userId"]);
      const entity = { tenantId: null, userId: "user-2" };
      expect(() => buildPrimaryKeyPredicate(entity as any, metadata)).toThrow(
        ProteusRepositoryError,
      );
    });

    test("throws when second PK field is undefined", () => {
      const metadata = makeMetadata(["tenantId", "userId"]);
      const entity = { tenantId: "tenant-1" };
      expect(() => buildPrimaryKeyPredicate(entity as any, metadata)).toThrow(
        ProteusRepositoryError,
      );
    });

    test("excludes non-PK fields from predicate", () => {
      const metadata = makeMetadata(["tenantId", "userId"]);
      const entity = { tenantId: "tenant-1", userId: "user-2", name: "extra" };
      const result = buildPrimaryKeyPredicate(entity as any, metadata);
      expect(result).toMatchSnapshot();
    });
  });
});
