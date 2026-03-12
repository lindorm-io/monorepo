import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { dehydrateEntity } from "./dehydrate-entity";

const baseMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("createdAt", {
      type: "timestamp",
      decorator: "CreateDate",
      name: "created_at",
    }),
    makeField("updatedAt", {
      type: "timestamp",
      decorator: "UpdateDate",
      name: "updated_at",
    }),
    makeField("version", { type: "integer", decorator: "Version" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

const entity = {
  id: "abc-123",
  name: "Alice",
  email: "alice@example.com",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
  version: 2,
};

describe("dehydrateEntity", () => {
  test("should dehydrate entity for insert", () => {
    const result = dehydrateEntity(entity, baseMetadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should dehydrate entity for update", () => {
    const result = dehydrateEntity(entity, baseMetadata, "update");
    expect(result).toMatchSnapshot();
  });

  test("should skip IDENTITY generated fields on insert", () => {
    const metadata = {
      ...baseMetadata,
      generated: [
        { key: "id", strategy: "increment", length: null, max: null, min: null },
      ],
    } as unknown as EntityMetadata;

    const result = dehydrateEntity(entity, metadata, "insert");
    expect(result.find((c) => c.column === "id")).toBeUndefined();
  });

  test("should skip PK and CreateDate on update", () => {
    const result = dehydrateEntity(entity, baseMetadata, "update");
    expect(result.find((c) => c.column === "id")).toBeUndefined();
    expect(result.find((c) => c.column === "created_at")).toBeUndefined();
  });

  test("should use column name from field.name", () => {
    const result = dehydrateEntity(entity, baseMetadata, "insert");
    expect(result.find((c) => c.column === "email_address")).toBeDefined();
    expect(result.find((c) => c.column === "email")).toBeUndefined();
  });

  test("should handle FK columns from owning-side relations", () => {
    const metadata = {
      ...baseMetadata,
      relations: [
        {
          key: "author",
          foreignConstructor: () => Object,
          foreignKey: "id",
          findKeys: null,
          joinKeys: { authorId: "id" },
          joinTable: null,
          options: {},
          type: "ManyToOne",
        },
      ],
    } as unknown as EntityMetadata;

    const entityWithFk = { ...entity, authorId: "author-456" };
    const result = dehydrateEntity(entityWithFk, metadata, "insert");
    expect(result.find((c) => c.column === "authorId")?.value).toBe("author-456");
  });

  test("should not duplicate FK columns already declared as fields", () => {
    const metadata = {
      ...baseMetadata,
      fields: [
        ...baseMetadata.fields,
        makeField("authorId", { type: "uuid", name: "author_id" }),
      ],
      relations: [
        {
          key: "author",
          foreignConstructor: () => Object,
          foreignKey: "id",
          findKeys: null,
          joinKeys: { authorId: "id" },
          joinTable: null,
          options: {},
          type: "ManyToOne",
        },
      ],
    } as unknown as EntityMetadata;

    const entityWithFk = { ...entity, authorId: "author-456" };
    const result = dehydrateEntity(entityWithFk, metadata, "insert");
    const authorCols = result.filter((c) => c.column === "author_id");
    expect(authorCols).toHaveLength(1);
  });

  test("should coerce BigInt values to string", () => {
    const metadata = {
      ...baseMetadata,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("bigNum", { type: "bigint", name: "big_num" }),
      ],
    } as unknown as EntityMetadata;

    const entityWithBigInt = { id: "abc", bigNum: BigInt("9007199254740993") };
    const result = dehydrateEntity(entityWithBigInt as any, metadata, "insert");
    expect(result.find((c) => c.column === "big_num")?.value).toBe("9007199254740993");
  });
});

describe("dehydrateEntity — embedded fields", () => {
  class EmbeddedAddress {
    street: string = "";
    city: string = "";
  }

  const embeddedMetadata = {
    entity: baseMetadata.entity,
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("address.street", {
        type: "string",
        name: "address_street",
        embedded: { parentKey: "address", constructor: () => EmbeddedAddress },
      }),
      makeField("address.city", {
        type: "string",
        name: "address_city",
        embedded: { parentKey: "address", constructor: () => EmbeddedAddress },
      }),
    ],
    relations: [],
    primaryKeys: ["id"],
    generated: [],
  } as unknown as EntityMetadata;

  test("should traverse nested object to dehydrate embedded fields", () => {
    const entityWithAddress = {
      id: "abc-123",
      address: { street: "123 Main St", city: "Springfield" },
    };
    const result = dehydrateEntity(entityWithAddress as any, embeddedMetadata, "insert");
    expect(result.find((c) => c.column === "address_street")?.value).toBe("123 Main St");
    expect(result.find((c) => c.column === "address_city")?.value).toBe("Springfield");
  });

  test("should produce null values when embedded parent object is null", () => {
    const entityWithNullAddress = { id: "abc-123", address: null };
    const result = dehydrateEntity(
      entityWithNullAddress as any,
      embeddedMetadata,
      "insert",
    );
    // null parent must yield null (not undefined) so SQL params are well-defined
    expect(result.find((c) => c.column === "address_street")?.value).toBeNull();
    expect(result.find((c) => c.column === "address_city")?.value).toBeNull();
  });

  test("should mix embedded and non-embedded fields correctly", () => {
    const mixedMetadata = {
      entity: baseMetadata.entity,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("name", { type: "string" }),
        makeField("address.street", {
          type: "string",
          name: "address_street",
          embedded: { parentKey: "address", constructor: () => EmbeddedAddress },
        }),
      ],
      relations: [],
      primaryKeys: ["id"],
      generated: [],
    } as unknown as EntityMetadata;

    const result = dehydrateEntity(
      {
        id: "abc-123",
        name: "Alice",
        address: { street: "456 Oak Ave", city: "Shelbyville" },
      } as any,
      mixedMetadata,
      "insert",
    );

    expect(result).toMatchSnapshot();
    expect(result.find((c) => c.column === "name")?.value).toBe("Alice");
    expect(result.find((c) => c.column === "address_street")?.value).toBe("456 Oak Ave");
  });

  test("should not use dotted key as flat entity key for embedded fields", () => {
    // Before the fix, dehydrateEntity read entity["address.city"] which returns undefined.
    // After the fix it traverses entity.address.city. This test confirms the old behavior is gone.
    const entityWithFlatKey = {
      id: "abc-123",
      // deliberately set the dotted key — old code would pick this up, new code must not
      "address.city": "WRONG",
      address: { street: "Right St", city: "Correct" },
    };
    const result = dehydrateEntity(entityWithFlatKey as any, embeddedMetadata, "insert");
    expect(result.find((c) => c.column === "address_city")?.value).toBe("Correct");
  });
});

describe("dehydrateEntity — transform.to", () => {
  const transformMetadata = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "users",
      namespace: "app",
    },
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("code", {
        type: "string",
        name: "code",
        transform: {
          to: (v: unknown) => (v as string).toUpperCase(),
          from: (v: unknown) => (v as string).toLowerCase(),
        },
      }),
    ],
    relations: [],
    primaryKeys: ["id"],
    generated: [],
    relationIds: [],
    relationCounts: [],
  } as unknown as EntityMetadata;

  test("should apply transform.to when value is non-null", () => {
    const result = dehydrateEntity(
      { id: "1", code: "hello" } as any,
      transformMetadata,
      "insert",
    );
    expect(result.find((c) => c.column === "code")?.value).toBe("HELLO");
  });

  test("should not apply transform.to when value is null — produces null without crash (F03)", () => {
    const result = dehydrateEntity(
      { id: "1", code: null } as any,
      transformMetadata,
      "insert",
    );
    expect(result.find((c) => c.column === "code")?.value).toBeNull();
  });
});

describe("dehydrateEntity — computed field skip", () => {
  const computedMetadata = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "users",
      namespace: "app",
    },
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("name", { type: "string" }),
      makeField("fullName", { type: "string", name: "full_name", computed: "fullName" }),
    ],
    relations: [],
    primaryKeys: ["id"],
    generated: [],
    relationIds: [],
    relationCounts: [],
  } as unknown as EntityMetadata;

  test("should skip computed fields from dehydrated output", () => {
    const result = dehydrateEntity(
      { id: "1", name: "Alice", fullName: "Alice Smith" } as any,
      computedMetadata,
      "insert",
    );
    expect(result.find((c) => c.column === "full_name")).toBeUndefined();
    expect(result.find((c) => c.column === "name")).toBeDefined();
  });
});

describe("dehydrateEntity — ManyToMany relation skip", () => {
  const m2mMetadata = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "posts",
      namespace: "app",
    },
    fields: [makeField("id", { type: "uuid" })],
    relations: [
      {
        key: "tags",
        foreignConstructor: () => Object,
        foreignKey: "id",
        findKeys: null,
        // M2M owning side — has joinKeys
        joinKeys: { tagId: "id" },
        joinTable: { name: "posts_x_tags", namespace: "app" },
        options: {},
        type: "ManyToMany",
      },
    ],
    primaryKeys: ["id"],
    generated: [],
    relationIds: [],
    relationCounts: [],
  } as unknown as EntityMetadata;

  test("should not include M2M joinKeys in dehydrated output", () => {
    const result = dehydrateEntity(
      { id: "post-1", tags: [] } as any,
      m2mMetadata,
      "insert",
    );
    // ManyToMany join keys must never appear as regular columns — they're managed via join table
    expect(result.find((c) => c.column === "tagId")).toBeUndefined();
    expect(result.find((c) => c.column === "id")).toBeDefined();
  });
});

describe("dehydrateEntity — FK resolved from relation object", () => {
  const relationFkMetadata = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "posts",
      namespace: "app",
    },
    fields: [makeField("id", { type: "uuid" }), makeField("title", { type: "string" })],
    relations: [
      {
        key: "author",
        foreignConstructor: () => Object,
        foreignKey: "id",
        findKeys: null,
        joinKeys: { authorId: "id" },
        joinTable: null,
        options: {},
        type: "ManyToOne",
      },
    ],
    primaryKeys: ["id"],
    generated: [],
    relationIds: [],
    relationCounts: [],
  } as unknown as EntityMetadata;

  test("should resolve FK from relation object when bare FK property is undefined", () => {
    // entity.authorId is absent — resolveJoinKeyValue falls back to entity.author.id
    const entityWithRelationObj = {
      id: "post-1",
      title: "Hello",
      author: { id: "author-1" },
    };
    const result = dehydrateEntity(
      entityWithRelationObj as any,
      relationFkMetadata,
      "insert",
    );
    expect(result.find((c) => c.column === "authorId")?.value).toBe("author-1");
  });
});
