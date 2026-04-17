import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import {
  extractFieldDictFromReturning,
  extractFieldDictFromAliased,
} from "./extract-field-dict";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe("extractFieldDictFromReturning", () => {
  test("should map column names to field keys", () => {
    const row = { id: "abc", name: "Alice", email_address: "alice@test.com" };
    const result = extractFieldDictFromReturning(row, metadata);
    expect(result).toMatchSnapshot();
    expect(result.id).toBe("abc");
    expect(result.name).toBe("Alice");
    expect(result.email).toBe("alice@test.com");
  });

  test("should default missing columns to null", () => {
    const row = { id: "abc" };
    const result = extractFieldDictFromReturning(row, metadata);
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
  });

  test("should preserve null values", () => {
    const row = { id: "abc", name: null, email_address: null };
    const result = extractFieldDictFromReturning(row, metadata);
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
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

    const row = { id: "abc", name: "Post", email_address: null, authorId: "user-1" };
    const result = extractFieldDictFromReturning(row, metaWithRelation);
    expect(result.authorId).toBe("user-1");
  });

  test("should skip ManyToMany relations in FK extraction", () => {
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

    const row = { id: "abc", name: "Post", email_address: null, tagId: "tag-1" };
    const result = extractFieldDictFromReturning(row, metaWithM2M);
    expect(result).not.toHaveProperty("tagId");
  });

  test("should omit FK column when absent from RETURNING row", () => {
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

    // Row does not contain authorId — FK should be omitted entirely, not set to null
    const row = { id: "abc", name: "Post", email_address: null };
    const result = extractFieldDictFromReturning(row, metaWithRelation);
    expect(result).not.toHaveProperty("authorId");
  });
});

describe("extractFieldDictFromAliased", () => {
  test("should map aliased column names to field keys", () => {
    const row = { t0_id: "abc", t0_name: "Alice", t0_email: "alice@test.com" };
    const result = extractFieldDictFromAliased(row, metadata, "t0");
    expect(result).toMatchSnapshot();
    expect(result.id).toBe("abc");
    expect(result.name).toBe("Alice");
    expect(result.email).toBe("alice@test.com");
  });

  test("should default absent aliases to null", () => {
    const row = { t0_id: "abc" };
    const result = extractFieldDictFromAliased(row, metadata, "t0");
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
  });

  test("should handle different table aliases", () => {
    const row = { t1_id: "abc", t1_name: "Alice", t1_email: "alice@test.com" };
    const result = extractFieldDictFromAliased(row, metadata, "t1");
    expect(result.id).toBe("abc");
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

    const row = { t0_id: "abc", t0_name: "Post", t0_email: null, t0_authorId: "user-1" };
    const result = extractFieldDictFromAliased(row, metaWithRelation, "t0");
    expect(result.authorId).toBe("user-1");
  });

  test("should handle embedded fields with dotted keys", () => {
    const metaWithEmbedded = {
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("address.city", {
          type: "string",
          name: "address_city",
          embedded: { parentKey: "address", constructor: () => Object as any },
        }),
      ],
      relations: [],
      primaryKeys: ["id"],
    } as unknown as EntityMetadata;

    // extractFieldDictFromAliased builds alias as `${tableAlias}_${field.key}`
    // so for key "address.city" with tableAlias "t0", alias is "t0_address.city"
    const row = { t0_id: "xyz", "t0_address.city": "London" };
    const result = extractFieldDictFromAliased(row, metaWithEmbedded, "t0");
    expect(result).toMatchSnapshot();
    expect(result["address.city"]).toBe("London");
  });

  test("should omit FK column when absent from aliased row", () => {
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

    // Row does not contain t0_authorId — FK should be omitted entirely
    const row = { t0_id: "abc", t0_name: "Post", t0_email: null };
    const result = extractFieldDictFromAliased(row, metaWithRelation, "t0");
    expect(result).not.toHaveProperty("authorId");
  });
});
