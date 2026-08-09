import { describe, expect, test } from "vitest";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import { matches } from "@lindorm/match";
import {
  CRITERIA_LOGICAL_OPERATORS,
  guardAppendOnly,
  guardDeleteDateField,
  guardEncryptedCriteria,
  guardEncryptedField,
  guardExpiryDateField,
  guardVersionFields,
  guardUpsertBlocked,
  querySelectableKeys,
  repositorySelectableKeys,
  validateRelationNames,
  validateSelectionKeys,
} from "./repository-guards.js";

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

describe("guardAppendOnly", () => {
  test("throws ProteusRepositoryError when appendOnly is true", () => {
    const metadata = makeMetadata({ appendOnly: true } as any);
    expect(() => guardAppendOnly(metadata, "update")).toThrow(ProteusRepositoryError);
  });

  test("includes entity name and method in error message", () => {
    const metadata = makeMetadata({ appendOnly: true } as any);
    expect(() => guardAppendOnly(metadata, "destroy")).toThrow(
      /Cannot destroy an append-only entity "TestEntity"/,
    );
  });

  test("error message matches snapshot", () => {
    const metadata = makeMetadata({ appendOnly: true } as any);
    expect(() => guardAppendOnly(metadata, "delete")).toThrowErrorMatchingSnapshot();
  });

  test("does not throw when appendOnly is false", () => {
    const metadata = makeMetadata({ appendOnly: false } as any);
    expect(() => guardAppendOnly(metadata, "update")).not.toThrow();
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

/**
 * The owning `*ToOne` shape: a foreign key hydration projects unasked, exposed
 * as a `@RelationId` with no `@Field` of its own.
 */
const owningRelation = { key: "author", type: "ManyToOne", joinKeys: { authorId: "id" } };

describe("querySelectableKeys", () => {
  test("returns the declared fields", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }, { key: "name" }] as any,
    });
    expect(querySelectableKeys(metadata)).toEqual(["id", "name"]);
  });

  test("adds an owning relation's auto-projected foreign key", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }] as any,
      relations: [owningRelation] as any,
      relationIds: [{ key: "authorId", relationKey: "author", column: null }],
    });
    expect(querySelectableKeys(metadata)).toEqual(["id", "authorId"]);
  });

  test("omits a @RelationId no column carries", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }] as any,
      relations: [{ key: "posts", type: "OneToMany", joinKeys: null }] as any,
      relationIds: [{ key: "postIds", relationKey: "posts", column: null }],
    });
    expect(querySelectableKeys(metadata)).toEqual(["id"]);
  });

  // A @RelationCount is written WITH a backing @Field, so it is in `fields` —
  // but nothing maintains that column, and a query returns the stored value.
  test("omits a @RelationCount even though it has a backing field", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }, { key: "postCount" }] as any,
      relationCounts: [{ key: "postCount", relationKey: "posts" }],
    });
    expect(querySelectableKeys(metadata)).toEqual(["id"]);
  });
});

describe("repositorySelectableKeys", () => {
  test("adds @RelationId properties that have no field of their own", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }] as any,
      relationIds: [{ key: "postIds", relationKey: "posts", column: null }],
    });
    expect(repositorySelectableKeys(metadata)).toEqual(["id", "postIds"]);
  });

  test("adds @RelationCount properties, backing field or not", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }, { key: "postCount" }] as any,
      relationCounts: [
        { key: "postCount", relationKey: "posts" },
        { key: "tagCount", relationKey: "tags" },
      ],
    });
    expect(repositorySelectableKeys(metadata)).toEqual(["id", "postCount", "tagCount"]);
  });

  test("lists a @RelationId that is also a declared field only once", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }, { key: "authorId" }] as any,
      relations: [owningRelation] as any,
      relationIds: [{ key: "authorId", relationKey: "author", column: null }],
    });
    expect(repositorySelectableKeys(metadata)).toEqual(["id", "authorId"]);
  });

  test("is the query set plus the values the repository loads after the rows", () => {
    const metadata = makeMetadata({
      fields: [{ key: "id" }, { key: "postCount" }] as any,
      relations: [owningRelation] as any,
      relationIds: [
        { key: "authorId", relationKey: "author", column: null },
        { key: "postIds", relationKey: "posts", column: null },
      ],
      relationCounts: [{ key: "postCount", relationKey: "posts" }],
    });
    expect(repositorySelectableKeys(metadata)).toEqual([
      ...querySelectableKeys(metadata),
      "postIds",
      "postCount",
    ]);
  });
});

describe("validateSelectionKeys", () => {
  const metadata = makeMetadata({
    fields: [{ key: "id" }, { key: "title" }, { key: "commentCount" }] as any,
    relationIds: [
      { key: "authorId", relationKey: "author", column: null },
      { key: "commentIds", relationKey: "comments", column: null },
    ],
    relationCounts: [{ key: "commentCount", relationKey: "comments" }],
    relations: [owningRelation, { key: "comments" }] as any,
  });

  test("does not throw for keys in the selectable set", () => {
    expect(() =>
      validateSelectionKeys(
        metadata,
        ["id", "authorId"],
        repositorySelectableKeys(metadata),
      ),
    ).not.toThrow();
  });

  test("does not throw for an empty key list", () => {
    expect(() =>
      validateSelectionKeys(metadata, [], repositorySelectableKeys(metadata)),
    ).not.toThrow();
  });

  test("throws ProteusRepositoryError for an unknown key", () => {
    expect(() =>
      validateSelectionKeys(metadata, ["titel"], repositorySelectableKeys(metadata)),
    ).toThrow(ProteusRepositoryError);
  });

  test("includes the unknown key and the selectable set in the message", () => {
    expect(() =>
      validateSelectionKeys(metadata, ["titel"], repositorySelectableKeys(metadata)),
    ).toThrow(
      'Unknown field "titel" on "TestEntity". Available: [id, title, authorId, commentIds, commentCount]',
    );
  });

  test("throws a distinct error when the key names a relation", () => {
    expect(() =>
      validateSelectionKeys(metadata, ["comments"], repositorySelectableKeys(metadata)),
    ).toThrow('Relation "comments" cannot be selected on "TestEntity"');
  });

  test("accepts a @RelationId and a @RelationCount on the repository surface", () => {
    expect(() =>
      validateSelectionKeys(
        metadata,
        ["commentIds", "commentCount"],
        repositorySelectableKeys(metadata),
      ),
    ).not.toThrow();
  });

  test("names the decorator when a @RelationId is not selectable on the surface", () => {
    expect(() =>
      validateSelectionKeys(metadata, ["commentIds"], querySelectableKeys(metadata)),
    ).toThrow('@RelationId "commentIds" cannot be selected on "TestEntity" here');
  });

  test("names the decorator when a @RelationCount is not selectable on the surface", () => {
    expect(() =>
      validateSelectionKeys(metadata, ["commentCount"], querySelectableKeys(metadata)),
    ).toThrow('@RelationCount "commentCount" cannot be selected on "TestEntity" here');
  });

  test("explains why rather than reporting an unknown field", () => {
    try {
      validateSelectionKeys(metadata, ["commentCount"], querySelectableKeys(metadata));
      throw new Error("expected validateSelectionKeys to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ProteusRepositoryError);
      expect((error as ProteusRepositoryError).code).toBe(
        "relation_value_not_selectable",
      );
      expect((error as ProteusRepositoryError).details).toMatchSnapshot();
    }
  });

  test("still accepts an owning *ToOne relation id, which the row carries", () => {
    expect(() =>
      validateSelectionKeys(metadata, ["authorId"], querySelectableKeys(metadata)),
    ).not.toThrow();
  });

  test("rejects a @RelationId when the caller passes fields alone as selectable", () => {
    expect(() =>
      validateSelectionKeys(
        metadata,
        ["authorId"],
        metadata.fields.map((f) => f.key),
      ),
    ).toThrow('@RelationId "authorId" cannot be selected on "TestEntity" here');
  });
});

describe("guardEncryptedField", () => {
  const metadata = makeMetadata({
    fields: [
      { key: "pin", encrypted: { condition: null, kryptos: null } },
      { key: "count", encrypted: null },
    ] as any,
  });

  test("does not throw for an unencrypted field", () => {
    expect(() => guardEncryptedField(metadata, "count", "increment")).not.toThrow();
  });

  test("does not throw for an unknown field", () => {
    expect(() => guardEncryptedField(metadata, "nope", "increment")).not.toThrow();
  });

  test("throws ProteusRepositoryError for an encrypted field", () => {
    expect(() => guardEncryptedField(metadata, "pin", "increment")).toThrow(
      ProteusRepositoryError,
    );
  });

  test("names the method that was refused", () => {
    expect(() => guardEncryptedField(metadata, "pin", "sum")).toThrow(
      'Cannot sum encrypted field "pin" on entity "TestEntity"',
    );
  });
});

describe("guardEncryptedCriteria", () => {
  const metadata = makeMetadata({
    fields: [
      { key: "id", encrypted: null, embedded: null },
      { key: "name", encrypted: null, embedded: null },
      { key: "sealed", encrypted: { condition: null, kryptos: null }, embedded: null },
      {
        key: "address.city",
        encrypted: { condition: null, kryptos: null },
        embedded: { parentKey: "address", constructor: () => class {} },
      },
      {
        key: "address.zip",
        encrypted: null,
        embedded: { parentKey: "address", constructor: () => class {} },
      },
    ] as any,
  });

  const expectRefused = (criteria: unknown) =>
    expect(() => guardEncryptedCriteria(metadata, criteria, "find")).toThrow(
      ProteusRepositoryError,
    );

  const expectAllowed = (criteria: unknown) =>
    expect(() => guardEncryptedCriteria(metadata, criteria, "find")).not.toThrow();

  describe("flat criteria", () => {
    test("refuses an encrypted field", () => {
      expectRefused({ sealed: "alice" });
    });

    test("refuses an encrypted field carrying a field-level operator", () => {
      expectRefused({ sealed: { $like: "ali%" } });
    });

    test("allows unencrypted fields", () => {
      expectAllowed({ id: "1", name: { $like: "a%" } });
    });

    test("allows an unknown key — resolving criteria keys is not this guard's job", () => {
      expectAllowed({ nope: 1 });
    });

    test("allows a key that only exists on Object.prototype", () => {
      // Regression: an `in`-based operator lookup answers true for
      // "constructor"/"toString", which would send a real field key down the
      // logical-operator branch instead of resolving it against the metadata.
      expectAllowed({ toString: "x", constructor: "y" });
    });

    test("allows no criteria at all", () => {
      expectAllowed(undefined);
      expectAllowed(null);
      expectAllowed({});
    });
  });

  describe("logical nesting", () => {
    test("refuses inside $and", () => {
      expectRefused({ $and: [{ sealed: "alice" }] });
    });

    test("refuses inside $or", () => {
      expectRefused({ $or: [{ name: "a" }, { sealed: "alice" }] });
    });

    test("refuses inside $not", () => {
      expectRefused({ $not: { sealed: "alice" } });
    });

    test("refuses at arbitrary depth", () => {
      expectRefused({
        $and: [{ name: "a" }, { $or: [{ id: "1" }, { $not: { sealed: "alice" } }] }],
      });
    });

    test("refuses when $and is handed a single condition rather than an array", () => {
      expectRefused({ $and: { sealed: "alice" } });
    });

    test("refuses when $not is handed an array rather than a single condition", () => {
      expectRefused({ $not: [{ sealed: "alice" }] });
    });

    test("allows logical nesting over unencrypted fields only", () => {
      expectAllowed({
        $and: [{ name: "a" }, { $or: [{ id: "1" }, { $not: { name: "b" } }] }],
      });
    });

    test("does not descend into a field-level operator's values", () => {
      // `sealed` here is a VALUE, not a criteria key — the walk must not treat
      // an $in element as a nested condition.
      expectAllowed({ name: { $in: ["sealed", "address.city"] } });
    });
  });

  describe("@Embedded parents", () => {
    test("refuses the nested shape when the child is encrypted", () => {
      expectRefused({ address: { city: "London" } });
    });

    test("refuses the dotted shape when the child is encrypted", () => {
      expectRefused({ "address.city": "London" });
    });

    test("allows the nested shape when only unencrypted children are named", () => {
      expectAllowed({ address: { zip: "N1" } });
    });

    test("refuses an encrypted child nested under a logical operator", () => {
      expectRefused({ $or: [{ address: { city: "London" } }] });
    });
  });

  test("the error names the digest-column way out", () => {
    expect(() =>
      guardEncryptedCriteria(metadata, { sealed: "alice" }, "findOne"),
    ).toThrow('Cannot filter on encrypted field "sealed" on entity "TestEntity"');

    try {
      guardEncryptedCriteria(metadata, { sealed: "alice" }, "findOne");
      throw new Error("expected guardEncryptedCriteria to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ProteusRepositoryError);
      expect((error as ProteusRepositoryError).details).toMatchSnapshot();
    }
  });
});

describe("criteria logical operators are pinned to @lindorm/match", () => {
  // The COMPILE-TIME half of the pin lives in repository-guards.ts: the
  // operator map is typed `Record<LogicalOperator, true>`, where
  // `LogicalOperator` is extracted from `Condition`'s own `$`-prefixed keys.
  // A fourth logical operator added to @lindorm/match therefore fails proteus'
  // BUILD as a missing property — that, not this test, is what catches drift.
  //
  // This test is the BEHAVIOURAL half: it proves every name the walk descends
  // through is one `matches()` really evaluates as a logical operator over the
  // whole object, rather than as a field key.
  test("every operator the walk descends through is logical in matches()", () => {
    expect(CRITERIA_LOGICAL_OPERATORS).toMatchSnapshot();

    // Were any of these read as a FIELD key, `object[key]` would be undefined
    // and every one of these would be false.
    expect(matches({ a: 1 }, { $and: [{ a: 1 }] } as any)).toBe(true);
    expect(matches({ a: 1 }, { $or: [{ a: 2 }, { a: 1 }] } as any)).toBe(true);
    expect(matches({ a: 1 }, { $not: { a: 2 } } as any)).toBe(true);
  });

  test("a non-logical $ key is a field-level operator, not a criteria key", () => {
    // `$like` sits INSIDE a field's value; as a criteria key it names nothing.
    // This is why the walk skips unrecognised `$` keys instead of resolving
    // them against the metadata.
    expect(matches({ a: "abc" }, { a: { $like: "ab%" } } as any)).toBe(true);
  });
});
