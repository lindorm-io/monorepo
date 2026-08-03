import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { defaultCreateEntity } from "../internal/entity/utils/default-create-entity.js";
import { defaultCloneEntity } from "../internal/entity/utils/default-clone-entity.js";
import { Embeddable } from "./Embeddable.js";
import { Embedded } from "./Embedded.js";
import { Encrypted } from "./Encrypted.js";
import { TypedJson } from "./TypedJson.js";
import { EmbeddedList } from "./EmbeddedList.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Nullable } from "./Nullable.js";
import { Generated } from "./Generated.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

@Embeddable()
class Address {
  @Field("string")
  street!: string;

  @Field("string")
  city!: string;

  @Field("string")
  @Nullable()
  zip!: string | null;
}

@Entity({ name: "UserWithTags" })
class UserWithTags {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @EmbeddedList("string")
  tags!: string[];
}

@Entity({ name: "UserWithAddresses" })
class UserWithAddresses {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @EmbeddedList(() => Address)
  addresses!: Address[];
}

@Entity({ name: "UserWithCustomTable" })
class UserWithCustomTable {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList("string", { tableName: "custom_user_tags" })
  tags!: string[];
}

@Entity({ name: "UserWithMultipleLists" })
class UserWithMultipleLists {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList("string")
  tags!: string[];

  @EmbeddedList("integer")
  scores!: number[];

  @EmbeddedList(() => Address)
  addresses!: Address[];
}

// ─── Metadata Staging ───────────────────────────────────────────────────────

describe("EmbeddedList — metadata staging", () => {
  test("should stage primitive embedded list in Symbol.metadata", () => {
    const meta = (UserWithTags as any)[Symbol.metadata];
    expect(meta.embeddedLists).toBeDefined();
    expect(meta.embeddedLists).toHaveLength(1);
    expect(meta.embeddedLists[0]).toMatchSnapshot();
  });

  test("should stage embeddable embedded list in Symbol.metadata", () => {
    const meta = (UserWithAddresses as any)[Symbol.metadata];
    expect(meta.embeddedLists).toBeDefined();
    expect(meta.embeddedLists).toHaveLength(1);
    expect(meta.embeddedLists[0]).toMatchSnapshot();
  });

  test("should stage custom table name in metadata", () => {
    const meta = (UserWithCustomTable as any)[Symbol.metadata];
    expect(meta.embeddedLists[0].tableName).toBe("custom_user_tags");
  });
});

// ─── Resolved Metadata ──────────────────────────────────────────────────────

describe("EmbeddedList — resolved metadata", () => {
  test("should resolve primitive collection metadata", () => {
    const metadata = getEntityMetadata(UserWithTags);
    expect(metadata.embeddedLists).toHaveLength(1);
    expect(metadata.embeddedLists[0]).toMatchSnapshot();
  });

  test("should resolve embeddable collection metadata", () => {
    const metadata = getEntityMetadata(UserWithAddresses);
    expect(metadata.embeddedLists).toHaveLength(1);
    expect(metadata.embeddedLists[0]).toMatchSnapshot();
  });

  test("should resolve custom table name", () => {
    const metadata = getEntityMetadata(UserWithCustomTable);
    expect(metadata.embeddedLists[0].tableName).toBe("custom_user_tags");
  });

  test("should auto-generate table name from entity + field key", () => {
    const metadata = getEntityMetadata(UserWithTags);
    expect(metadata.embeddedLists[0].tableName).toBe("user_with_tags_tags");
  });

  test("should set correct parent FK and PK columns", () => {
    const metadata = getEntityMetadata(UserWithTags);
    const el = metadata.embeddedLists[0];
    expect(el.parentPkColumn).toBe("id");
    expect(el.parentFkColumn).toBe("user_with_tags_id");
  });

  test("should set elementType for primitive lists", () => {
    const metadata = getEntityMetadata(UserWithTags);
    const el = metadata.embeddedLists[0];
    expect(el.elementType).toBe("string");
    expect(el.elementFields).toBeNull();
    expect(el.elementConstructor).toBeNull();
  });

  test("should set elementFields for embeddable lists", () => {
    const metadata = getEntityMetadata(UserWithAddresses);
    const el = metadata.embeddedLists[0];
    expect(el.elementType).toBeNull();
    expect(el.elementFields).toHaveLength(3); // street, city, zip
    expect(el.elementConstructor).toEqual(expect.any(Function));
  });

  test("should resolve multiple embedded lists", () => {
    const metadata = getEntityMetadata(UserWithMultipleLists);
    expect(metadata.embeddedLists).toHaveLength(3);

    const names = metadata.embeddedLists.map((el) => el.key);
    expect(names).toEqual(["tags", "scores", "addresses"]);
  });

  test("should not include embedded list keys in entity fields", () => {
    const metadata = getEntityMetadata(UserWithTags);
    const fieldKeys = metadata.fields.map((f) => f.key);
    expect(fieldKeys).not.toContain("tags");
  });

  test("should merge field modifiers from embeddable class", () => {
    const metadata = getEntityMetadata(UserWithAddresses);
    const el = metadata.embeddedLists[0];
    const zipField = el.elementFields!.find((f) => f.key === "zip");
    expect(zipField!.nullable).toBe(true);
  });
});

// ─── Validation / Error Cases ───────────────────────────────────────────────

describe("EmbeddedList — validation", () => {
  test("should throw when referencing a non-embeddable class", () => {
    class NotEmbeddable {
      @Field("string")
      value!: string;
    }

    expect(() => {
      @Entity({ name: "BadEmbeddedListEntity" })
      class BadEmbeddedListEntity {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @EmbeddedList(() => NotEmbeddable as any)
        items!: any[];
      }

      getEntityMetadata(BadEmbeddedListEntity);
    }).toThrow(/not decorated with @Embeddable/);
  });
});

// ─── createEntity ───────────────────────────────────────────────────────────

describe("EmbeddedList — createEntity", () => {
  test("should initialize primitive array from options", () => {
    const entity = defaultCreateEntity(UserWithTags, {
      name: "Alice",
      tags: ["ts", "node"],
    } as any);

    expect(entity.tags).toEqual(["ts", "node"]);
  });

  test("should initialize embeddable array from options", () => {
    const entity = defaultCreateEntity(UserWithAddresses, {
      name: "Alice",
      addresses: [
        { street: "123 Main St", city: "Springfield", zip: "62704" },
        { street: "456 Oak Ave", city: "Shelbyville", zip: null },
      ],
    } as any);

    expect(entity.addresses).toHaveLength(2);
    expect(entity.addresses[0].street).toBe("123 Main St");
    expect(entity.addresses[1].zip).toBeNull();
  });

  test("should default to empty array when not provided", () => {
    const entity = defaultCreateEntity(UserWithTags, {
      name: "Bob",
    } as any);

    expect(entity.tags).toEqual([]);
  });

  test("should handle explicit empty array", () => {
    const entity = defaultCreateEntity(UserWithTags, {
      name: "Carol",
      tags: [],
    } as any);

    expect(entity.tags).toEqual([]);
  });

  test("should shallow-copy the input array (not share reference)", () => {
    const inputTags = ["ts", "node"];
    const entity = defaultCreateEntity(UserWithTags, {
      name: "Dave",
      tags: inputTags,
    } as any);

    expect(entity.tags).toEqual(inputTags);
    expect(entity.tags).not.toBe(inputTags);
  });
});

// ─── cloneEntity ────────────────────────────────────────────────────────────

describe("EmbeddedList — cloneEntity", () => {
  test("should deep-clone primitive array", () => {
    const original = defaultCreateEntity(UserWithTags, {
      name: "Alice",
      tags: ["ts", "node"],
    } as any);

    const cloned = defaultCloneEntity(UserWithTags, original);

    expect(cloned.tags).toEqual(["ts", "node"]);
    expect(cloned.tags).not.toBe(original.tags);
  });

  test("should deep-clone embeddable array", () => {
    const original = defaultCreateEntity(UserWithAddresses, {
      name: "Alice",
      addresses: [{ street: "123 Main St", city: "Springfield", zip: "62704" }],
    } as any);

    const cloned = defaultCloneEntity(UserWithAddresses, original);

    expect(cloned.addresses).toHaveLength(1);
    expect(cloned.addresses[0].street).toBe("123 Main St");
    expect(cloned.addresses).not.toBe(original.addresses);
    // Deep clone — inner objects are also distinct
    expect(cloned.addresses[0]).not.toBe(original.addresses[0]);
  });

  test("should clone empty array", () => {
    const original = defaultCreateEntity(UserWithTags, {
      name: "Bob",
    } as any);

    const cloned = defaultCloneEntity(UserWithTags, original);

    expect(cloned.tags).toEqual([]);
  });
});

// ─── Full Metadata Snapshot ─────────────────────────────────────────────────

describe("EmbeddedList — full metadata snapshot", () => {
  test("should match snapshot for primitive collection entity", () => {
    const metadata = getEntityMetadata(UserWithTags);
    expect(metadata).toMatchSnapshot();
  });

  test("should match snapshot for embeddable collection entity", () => {
    const metadata = getEntityMetadata(UserWithAddresses);
    expect(metadata).toMatchSnapshot();
  });

  test("should match snapshot for custom table name entity", () => {
    const metadata = getEntityMetadata(UserWithCustomTable);
    expect(metadata).toMatchSnapshot();
  });

  test("should match snapshot for multiple lists entity", () => {
    const metadata = getEntityMetadata(UserWithMultipleLists);
    expect(metadata).toMatchSnapshot();
  });
});

// ─── @Encrypted element rejection ───────────────────────────────────────────
//
// The SAME @Embeddable is legal in both positions. Flattened by @Embedded its
// fields land in `metadata.fields`, where the source-level `encryption` default,
// `stageFieldDecorator` and `validateEncryptedFields` all reach them. As an
// @EmbeddedList element they are a different table's columns and none of those
// reach them — a bare @Encrypted() there would seal the value under a key
// nothing ever named. So the collection-table position refuses it.

@Embeddable()
class SecretHolder {
  @Field("string")
  label!: string;

  @Encrypted({ condition: { purpose: "test" } })
  @Field("string")
  token!: string;
}

@Entity({ name: "UserWithSecretList" })
class UserWithSecretList {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList(() => SecretHolder)
  secrets!: Array<SecretHolder>;
}

@Entity({ name: "UserWithSecretEmbedded" })
class UserWithSecretEmbedded {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Embedded(() => SecretHolder)
  secret!: SecretHolder | null;
}

describe("EmbeddedList — @Encrypted elements", () => {
  test("should reject an @Encrypted field on an embeddable element", () => {
    expect(() => getEntityMetadata(UserWithSecretList)).toThrow(
      /@Encrypted cannot be used on @EmbeddedList element field "token"/,
    );
  });

  test("should still allow the same embeddable under @Embedded", () => {
    const metadata = getEntityMetadata(UserWithSecretEmbedded);
    const field = metadata.fields.find((f) => f.key === "secret.token");
    expect(field?.encrypted).toEqual({
      kryptos: null,
      condition: { purpose: "test" },
    });
  });
});

// ─── @TypedJson element rejection ───────────────────────────────────────────
//
// @TypedJson is a TWO-column field: JSON-safe data in the declared column, the
// JsonKit type metadata in a sidecar beside it. A collection table projects only
// the element columns it can see, so the sidecar is never created and the
// element read/write paths have no half to carry it — the type fidelity the
// decorator exists for is silently lost. Wiring it up is a schema change, not a
// missed branch, so the collection-table position refuses it.

@Embeddable()
class TypedPayloadHolder {
  @Field("string")
  label!: string;

  @TypedJson()
  @Field("json")
  payload!: Record<string, unknown>;
}

@Entity({ name: "UserWithTypedPayloadList" })
class UserWithTypedPayloadList {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList(() => TypedPayloadHolder)
  payloads!: Array<TypedPayloadHolder>;
}

@Entity({ name: "UserWithTypedPayloadEmbedded" })
class UserWithTypedPayloadEmbedded {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Embedded(() => TypedPayloadHolder)
  payload!: TypedPayloadHolder | null;
}

describe("EmbeddedList — @TypedJson elements", () => {
  test("should reject a @TypedJson field on an embeddable element", () => {
    expect(() => getEntityMetadata(UserWithTypedPayloadList)).toThrow(
      /@TypedJson cannot be used on @EmbeddedList element field "payload"/,
    );
  });

  test("should still allow the same embeddable under @Embedded", () => {
    const metadata = getEntityMetadata(UserWithTypedPayloadEmbedded);
    const field = metadata.fields.find((f) => f.key === "payload.payload");
    expect(field?.name).toBe("payload_payload");
    expect(field?.typedJson).not.toBeNull();
  });
});
