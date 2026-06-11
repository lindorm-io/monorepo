import type { EntityMetadata } from "../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import { buildConflictPredicate } from "./build-conflict-predicate.js";
import { describe, expect, test } from "vitest";

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "Account",
    namespace: "app",
  },
} as unknown as EntityMetadata;

describe("buildConflictPredicate", () => {
  test("builds predicate from a single conflictOn field", () => {
    const entity = { id: "abc", email: "user@test.com", name: "test" };
    const result = buildConflictPredicate(entity as any, metadata, ["email"]);
    expect(result).toMatchSnapshot();
  });

  test("builds predicate from multiple conflictOn fields", () => {
    const entity = { id: "abc", tenantId: "t-1", email: "user@test.com" };
    const result = buildConflictPredicate(entity as any, metadata, ["tenantId", "email"]);
    expect(result).toMatchSnapshot();
  });

  test("excludes non-conflict fields from the predicate", () => {
    const entity = { id: "abc", email: "user@test.com", name: "ignored" };
    const result = buildConflictPredicate(entity as any, metadata, ["email"]);
    expect(result).toMatchSnapshot();
  });

  test("throws ProteusRepositoryError when a conflict field is null", () => {
    const entity = { id: "abc", email: null };
    expect(() => buildConflictPredicate(entity as any, metadata, ["email"])).toThrow(
      ProteusRepositoryError,
    );
  });

  test("throws ProteusRepositoryError when a conflict field is undefined", () => {
    const entity = { id: "abc" };
    expect(() => buildConflictPredicate(entity as any, metadata, ["email"])).toThrow(
      ProteusRepositoryError,
    );
  });

  test("throws with informative message including field name and entity name", () => {
    const entity = { id: "abc", email: null };
    expect(() => buildConflictPredicate(entity as any, metadata, ["email"])).toThrow(
      'Cannot build conflict predicate: field "email" is null or undefined on "Account"',
    );
  });
});
