import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "../types/metadata";
import { defaultDehydrateEntity } from "./default-dehydrate-entity";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("version", { type: "integer", decorator: "Version" }),
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
    makeField("readonlyField", {
      type: "string",
      decorator: "Field",
      readonly: true,
      name: "readonly_field",
    }),
  ],
  primaryKeys: ["id"],
  generated: [{ key: "seq", strategy: "increment" }],
  relations: [],
} as unknown as EntityMetadata;

const entity = {
  id: "abc-123",
  name: "Alice",
  email: "alice@example.com",
  version: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  readonlyField: "immutable",
  seq: 42,
} as any;

describe("defaultDehydrateEntity", () => {
  test("should dehydrate for insert — skip increments only", () => {
    const result = defaultDehydrateEntity(entity, metadata, "insert");
    expect(result).toMatchSnapshot();
    expect(result).not.toHaveProperty("seq");
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("created_at");
    expect(result).toHaveProperty("readonly_field");
  });

  test("should dehydrate for update — skip PKs, CreateDate, readonly, increments", () => {
    const result = defaultDehydrateEntity(entity, metadata, "update");
    expect(result).toMatchSnapshot();
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("readonly_field");
    expect(result).not.toHaveProperty("seq");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("email_address");
  });

  test("should use column name (field.name) as key", () => {
    const result = defaultDehydrateEntity(entity, metadata, "insert");
    expect(result.email_address).toBe("alice@example.com");
    expect(result).not.toHaveProperty("email");
  });

  test("should extract FK columns from owning relations", () => {
    const metaWithRelation = {
      ...metadata,
      relations: [
        {
          key: "author",
          type: "ManyToOne",
          joinKeys: { authorId: "id" },
        },
      ],
    } as unknown as EntityMetadata;

    const entityWithFK = { ...entity, authorId: "user-1" };
    const result = defaultDehydrateEntity(
      entityWithFK as any,
      metaWithRelation,
      "insert",
    );
    expect(result.authorId).toBe("user-1");
  });

  test("should resolve FK from related entity when bare FK is undefined", () => {
    const metaWithRelation = {
      ...metadata,
      relations: [
        {
          key: "author",
          type: "ManyToOne",
          joinKeys: { authorId: "id" },
        },
      ],
    } as unknown as EntityMetadata;

    const entityWithRelated = { ...entity, author: { id: "user-2" } };
    const result = defaultDehydrateEntity(
      entityWithRelated as any,
      metaWithRelation,
      "insert",
    );
    expect(result.authorId).toBe("user-2");
  });

  test("should apply transform.to() for non-null field values", () => {
    const metaWithTransform = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("slug", {
          type: "string",
          transform: {
            to: (v: unknown) => (v as string).toLowerCase(),
            from: (v: unknown) => v,
          },
        }),
      ],
    } as unknown as EntityMetadata;

    const entityWithSlug = { ...entity, slug: "HELLO-WORLD" };
    const result = defaultDehydrateEntity(
      entityWithSlug as any,
      metaWithTransform,
      "insert",
    );
    expect(result.slug).toBe("hello-world");
  });

  test("should not apply transform.to() for null values", () => {
    const metaWithTransform = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("slug", {
          type: "string",
          nullable: true,
          transform: {
            to: (v: unknown) => (v as string).toLowerCase(),
            from: (v: unknown) => v,
          },
        }),
      ],
    } as unknown as EntityMetadata;

    const entityWithNull = { ...entity, slug: null };
    const result = defaultDehydrateEntity(
      entityWithNull as any,
      metaWithTransform,
      "insert",
    );
    expect(result.slug).toBeNull();
  });

  test("should skip computed fields", () => {
    const metaWithComputed = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("fullName", {
          type: "string",
          computed: "first_name || ' ' || last_name",
        }),
      ],
    } as unknown as EntityMetadata;

    const entityWithComputed = { ...entity, fullName: "should be skipped" };
    const result = defaultDehydrateEntity(
      entityWithComputed as any,
      metaWithComputed,
      "insert",
    );
    expect(result).not.toHaveProperty("fullName");
  });

  test("should skip ManyToMany relations", () => {
    const metaWithM2M = {
      ...metadata,
      relations: [
        {
          key: "tags",
          type: "ManyToMany",
          joinKeys: { tagId: "id" },
        },
      ],
    } as unknown as EntityMetadata;

    const result = defaultDehydrateEntity(entity, metaWithM2M, "insert");
    expect(result).not.toHaveProperty("tagId");
  });
});

describe("defaultDehydrateEntity — embedded fields", () => {
  class EmbeddedAddress {
    street: string = "";
    city: string = "";
    zip: string | null = null;
  }

  const embeddedMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("homeAddress.street", {
        type: "string",
        name: "homeAddress_street",
        nullable: true,
        embedded: { parentKey: "homeAddress", constructor: () => EmbeddedAddress },
      }),
      makeField("homeAddress.city", {
        type: "string",
        name: "homeAddress_city",
        nullable: true,
        embedded: { parentKey: "homeAddress", constructor: () => EmbeddedAddress },
      }),
      makeField("homeAddress.zip", {
        type: "string",
        name: "homeAddress_zip",
        nullable: true,
        embedded: { parentKey: "homeAddress", constructor: () => EmbeddedAddress },
      }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  test("should flatten embedded object into prefixed column names", () => {
    const embeddedEntity = {
      id: "abc",
      homeAddress: { street: "123 Main St", city: "Springfield", zip: "62704" },
    } as any;

    const result = defaultDehydrateEntity(embeddedEntity, embeddedMetadata, "insert");

    expect(result).toMatchSnapshot();
    expect(result["homeAddress_street"]).toBe("123 Main St");
    expect(result["homeAddress_city"]).toBe("Springfield");
    expect(result["homeAddress_zip"]).toBe("62704");
    // Original field key should not appear
    expect(result).not.toHaveProperty("homeAddress");
    expect(result).not.toHaveProperty("homeAddress.street");
  });

  test("should emit null for all embedded columns when embedded is null", () => {
    const embeddedEntity = {
      id: "abc",
      homeAddress: null,
    } as any;

    const result = defaultDehydrateEntity(embeddedEntity, embeddedMetadata, "insert");

    expect(result["homeAddress_street"]).toBeNull();
    expect(result["homeAddress_city"]).toBeNull();
    expect(result["homeAddress_zip"]).toBeNull();
  });

  test("should emit null for all embedded columns when embedded is undefined", () => {
    const embeddedEntity = {
      id: "abc",
    } as any;

    const result = defaultDehydrateEntity(embeddedEntity, embeddedMetadata, "insert");

    expect(result["homeAddress_street"]).toBeNull();
    expect(result["homeAddress_city"]).toBeNull();
    expect(result["homeAddress_zip"]).toBeNull();
  });

  test("should preserve null sub-fields within non-null embedded object", () => {
    const embeddedEntity = {
      id: "abc",
      homeAddress: { street: "456 Oak Ave", city: "Shelbyville", zip: null },
    } as any;

    const result = defaultDehydrateEntity(embeddedEntity, embeddedMetadata, "insert");

    expect(result["homeAddress_street"]).toBe("456 Oak Ave");
    expect(result["homeAddress_city"]).toBe("Shelbyville");
    expect(result["homeAddress_zip"]).toBeNull();
  });

  test("should skip embedded fields for update mode like regular fields", () => {
    // update mode only additionally skips PKs / CreateDate / readonly — embedded fields otherwise included
    const embeddedEntity = {
      id: "abc",
      homeAddress: { street: "789 Elm St", city: "Capital City", zip: "10001" },
    } as any;

    const result = defaultDehydrateEntity(embeddedEntity, embeddedMetadata, "update");

    // id (PK) excluded in update mode
    expect(result).not.toHaveProperty("id");
    // embedded fields still present
    expect(result["homeAddress_street"]).toBe("789 Elm St");
  });
});
